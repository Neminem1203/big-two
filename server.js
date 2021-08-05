const express = require('express');
const path = require('path');
const app = express();
const mongoose = require('mongoose');
const crypto = require('crypto');
const server = require("http").createServer();
const io = require("socket.io")(server, {
    transports: ["websocket", "polling"]
});

const User = require('./models/users');
const Room = require('./models/room');

app.use(
    express.urlencoded({
        extended: true
    })
)

app.use(express.json());


const INVALID_CREDENTIALS = "Login Credentials Invalid";
const ROOM_NAME_TAKEN = "Room name exists";

app.use(express.static('client/build'));
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
})

// Login
app.post("/api/login", (req, res)=>{
    let hash = req.body.password;
    let username = req.body.username;
    let errors = [];
    if(username == ""){
        errors.push("Username Required");
        res.send({uuid: null, username, errors})
    } else {
        User.findOne({username})
            .then(db_user => {
                let uuid = null;
                if(db_user){ // Login
                    if(db_user.password == hash){
                        uuid = db_user._id;
                    } else {
                        errors.push(INVALID_CREDENTIALS);
                    }
                    res.send({uuid, username, errors})
                } else{ // Register
                    const newUser = new User({
                        username: username,
                        password: hash
                    })
                    newUser.save()
                        .then(result => res.send({uuid: result._id, username, errors}))
                        .catch(err => errors.push(err));
                }
            }).catch(err => console.log(err));
    }
});

// Get a list of all public rooms
app.get("/api/get_rooms", (req, res)=>{
    Room.find()
        .then(db_rooms =>{
            res.send({rooms: db_rooms.map(room => room.name)})
        }).catch(errors => res.send({errors}))
});

// Create a new room
app.post("/api/create_room", (req, res)=>{
    Room.findOne({name: req.body.name})
        .then(db_room => {
            if(db_room){
                res.send({errors: ROOM_NAME_TAKEN})
            } else {
                const newRoom = new Room({
                    name: req.body.name,
                    players: new Array(4).fill("")
                })
                newRoom.save();
                res.send({room: newRoom.name})
            }
        })
        .catch(errors => res.send({errors}))
    io.emit("refresh_rooms");
})

// Gets the users current room
app.post("/api/get_current_room", (req, res)=>{
    User.findById(req.body.uuid)
        .then(db_user => res.send(db_user.room))
        .catch(errors => res.send({errors}))
})

// Join a room with the current user
app.post("/api/join_room", (req, res)=>{
    User.findById(req.body.uuid)
        .then(db_user => {
            db_user.room = req.body.room_name;
            db_user.save();
            res.send({room_name: req.body.room_name})
        }).catch(errors => res.send({errors}))
});

const uid_to_name = {};
const uid_to_room = {};
const name_to_uid = {};


async function updateRoomDB(name, updated){
    return await Room.findOneAndUpdate({name}, updated)
}


async function disconnect_from_room(room_name, username){
    await Room.findOne({name: room_name})
        .then(db_room => {
            let players = db_room.players;
            for(let i = 0; i < 4; i++){
                if(players[i] == username){
                    players[i] = undefined;
                }
            }
            updateRoomDB(db_room.name, {players})
        })
}

function same_val(card_arr){
    let card_values = card_arr.map(ele => Math.floor(ele/4))
    return card_values.every(ele => ele === card_values[0])
}

function five_card_value(card_arr){
    let card_vals = card_arr.map(card => Math.floor(card/4))
    let card_face = card_arr.map(card => card%4)
    // straight flush = 250 + highest_card_value
    let straight = true;
    for(let i = 1; i < 5; i++){
        if(card_vals[i]-1 !== card_vals[i-1]){
            straight = false;
        }
    }
    let flush = card_face.every(suit => suit === card_face[0])
    if(straight && flush){
        return 250 + card_arr[4];
    }
    // straight = 50 + highest_card_value
    if(straight){
        return 50 + card_arr[4];
    }
    // flush = 100 + highest_card_value
    if(flush){
        return 100 + card_arr[4];
    }
    // four of a kind = 200 + highest_quad_value
    if( same_val( card_arr.slice(0,4) ) ){
        return 200 + card_arr[4];
    } 
    if ( same_val ( card_arr.slice(1))){
        return 200 + card_arr[5];
    }
    // full house = 150 + highest_triple_value
    if( same_val( card_arr.slice(0,3) ) && same_val( card_arr.slice(3) ) ){ // triples are the lower half of the hand
        return 150 + card_arr[2];
    } 
    if ( same_val( card_arr.slice(0,2)) && same_val (card_arr.slice(2) )){ // triples are the higher half of the hand
        return 150 + card_arr[5]; // triple are at the end
    }
    // invalid = 0
    return 0;
}

function cardValueGT(card_arr, to_beat){
    // checks validity and same length
    if(!validCard(card_arr) || card_arr.length !== to_beat.length) return false;
    switch(card_arr.length){
        case 1: // single card
            return card_arr[0] >= to_beat[0]
        case 2: // doubles: higher suit always wins eg. 3D + 3S > 3C + 3H 
            return card_arr[1] > to_beat[1]
        case 3: // triples
            return card_arr[2] > to_beat[2]
        case 5: // five-card hand
            return five_card_value(card_arr) > five_card_value(to_beat)
        default:
            return false;
    }
}

function validCard(card_arr){
    switch(card_arr.length){
        case 1:
            return true;
        case 2:
            if(!same_val(card_arr)) return false;
            return true;
        case 3:
            if(!same_val(card_arr)) return false;
        case 5:
            if(five_card_value(card_arr) === 0) return false;
            return true;
        default:
            return false;
    }
}

function playCards(hand, cards){
    let newHand = [];
    for(let i = 0; i < hand.length; i++){
        if(!cards.includes(hand[i])){
            newHand.push(hand[i]);
        }
    }
    newHand.sort();
    return newHand;
}

function playerHand(hands, names, ind){
    let handArr = [];
    let nameArr = [];
    let player_hand = hands[ind]
    player_hand.sort((a,b) => a-b)
    handArr.push(player_hand)
    nameArr.push(names[ind])
    for(let i = 1; i < 4; i++){
        handArr.push(hands[(ind+i)%4].length);
        nameArr.push(names[(ind+i)%4]);
    }
    return [handArr, nameArr]
}


io.on("connection", client =>{
    // Login. Unique sessions so we disconnect any old sessions
    client.on("login", username => {
        const old_uid = name_to_uid[username];
        if(old_uid && old_uid !== client.id){
            if(uid_to_room[old_uid]){
                let old_room = uid_to_room[old_uid]
                // disconnect_from_room(uid_to_room[old_uid], uid_to_name[old_uid]);
                delete(uid_to_room[old_uid]);
                uid_to_room[client.id] = old_room;
                // remove old client from the room and login the new client into the room
                Room.findOne({name: old_room})
                    .then(db_room => {
                        io.to(client.id).emit("join_room", {room_name: old_room, players: db_room.players})
                    })
                
            }
            console.log(`Disconnecting old uid ${old_uid}`)
            io.to(old_uid).emit("force_logout");
            delete(name_to_uid[uid_to_name[old_uid]])
            delete(uid_to_name[old_uid])
        }
        uid_to_name[client.id] = username;
        name_to_uid[username] = client.id;
    })
    // DEBUGGING PURPOSES
    client.on("debugging", ()=>{
        console.log("UID_TO_NAME", uid_to_name);
        console.log("UID_TO_ROOM", uid_to_room);
        console.log("NAME_TO_UID", name_to_uid, "\n");
    })
    // client joins a room
    client.on("join_room", room_name => {
        if(room_name != "" && uid_to_name[client.id]){
            Room.findOne({name:room_name})
                .then(db_room => {
                    let players = db_room.players;
                    for(let i = 0; i < 4; i++){
                        if(!players[i]){
                            players[i] = uid_to_name[client.id];
                            updateRoomDB(db_room.name, {players})
                            uid_to_room[client.id] = room_name;
                            io.to(client.id).emit("join_room", {room_name, players})
                            break;
                        }
                    }
                })
        } else{// empty join room = leave room
            if(uid_to_room[client.id]){
                disconnect_from_room(uid_to_room[client.id], uid_to_name[client.id]);
            }
            delete(uid_to_room[client.id]);
            io.to(client.id).emit("join_room", "") 
        }
    })
    // start of the game
    client.on("start_game", (name) =>{
        Room.findOne({name})
            .then(db_room => {
                let errors = [];
                if(db_room.center_card.length > 0){
                    errors.push("Game Already Started");
                }
                if(!db_room.players.every(player_name => player_name)){
                    errors.push("Not Enough Players");
                }


                if(errors.length === 0){
                    // start of game has no cards on top
                    let deck = [...Array(52).keys()];
                    for (let i = deck.length - 1; i > 0; i--) { // shuffling deck
                        const j = Math.floor(Math.random() * (i + 1));
                        [deck[i], deck[j]] = [deck[j], deck[i]];
                    }
                    // first player has the 3 of diamonds
                    let first_player_ind = Math.floor(deck.findIndex(ele => ele === 0)/13);
                    let first_player = db_room.players[first_player_ind]
                    // distribute player hands
                    let playerHands = new Array(4);
                    for(let i = 0; i < 4; i++){
                        const hand = deck.slice(13*i, 13*(i+1));
                        hand.sort((a,b) => a-b);
                        playerHands[i] = hand;
                    }
                    db_room.players.forEach((player_name, ind) =>{
                        let hands = [];
                        let playerNames = [];
                        hands.push(playerHands[ind])
                        playerNames.push(player_name);
                        for(let i = 1; i < 4; i++){
                            hands.push(playerHands[(ind+i)%4].length);
                            playerNames.push(db_room.players[(ind+i)%4]);
                        }
                        io.to(name_to_uid[player_name]).emit("setup", {playerNames, hands, first_player})
                        // io.to(name_to_uid[player_name]).emit("player_names", playerNames);
                        // io.to(name_to_uid[player_name]).emit("player_hands", hands);
                        // io.to(name_to_uid[player_name]).emit("center_card", {card_arr: [], player: first_player})
                        // io.to(name_to_uid[player_name]).emit("player_turn", {player: first_player});
                    })
                    updateRoomDB(db_room.name, {
                        center_card: [[], first_player], 
                        hands: playerHands,
                        current_players_turn: first_player
                    })
                } else{
                    io.emit("error", errors)
                }
            })
    })

    // Playing a card with validations
    client.on("play_cards", (cards) =>{
        let name = uid_to_room[client.id];
        let username = uid_to_name[client.id];
        Room.findOne({name})
            .then(db_room => {
                let [center_card_arr, center_card_player] = db_room.center_card;
                let client_ind = db_room.players.indexOf(username);
                // error checking
                if(username !== db_room.current_players_turn){ // not the players turn
                    io.to(client.id).emit("error", ["Not your turn"])
                } else if(!cards.every(card_id => db_room.hands[client_ind].includes(card_id))){ // sent over invalid card arr
                    io.to(client.id).emit("error", ["Invalid cards"])
                } else if(username === center_card_player && validCard(cards)){ // freebie
                    if(center_card_arr.length === 0 && !cards.includes(0)){ //Beginning of the game
                        io.to(client.id).emit("error", ["First hand must include 3 of Diamonds"])
                    } else{
                        // TODO: DRY
                        let newHands = db_room.hands;
                        let freebie_player = db_room.players[client_ind];
                        newHands[client_ind] = playCards(newHands[client_ind], cards)
                        let next_player_ind = (client_ind + 1) % 4;
                        while(newHands[next_player_ind].length === 0){
                            next_player_ind = (next_player_ind + 1) % 4
                        }
                        let next_player = db_room.players[next_player_ind];
                        if(db_room.hands[client_ind] === 0){
                            freebie_player = next_player
                        }
                        for(let ind = 0; ind < 4; ind++){
                            let player_id = name_to_uid[db_room.players[ind]];
                            io.to(player_id).emit("card_play", {card_arr:cards, card_player:username, next_player, hands_names: playerHand(newHands, db_room.players, ind)})
                            if(newHands.map(hand => hand.length).map(len => len === 0).reduce((acc, bool) => bool ? acc + 1 : acc) > 0){
                                io.to(player_id).emit("game_over");
                            }
                        }
                        updateRoomDB(name, {hands: newHands, center_card: [cards, freebie_player], current_players_turn: next_player} )
                    }
                } else if(cardValueGT(cards, center_card_arr)){
                    // TODO: this is repeat above the top but i'm too tired to DRY 
                    let newHands = db_room.hands;
                    newHands[client_ind] = playCards(newHands[client_ind], cards)
                    let next_player_ind = (client_ind + 1) % 4;
                    while(newHands[next_player_ind].length === 0){
                        next_player_ind = (next_player_ind + 1) % 4
                    }
                    let next_player = db_room.players[next_player_ind];
                    for(let ind = 0; ind < 4; ind++){
                        let player_id = name_to_uid[db_room.players[ind]];
                        io.to(player_id).emit("card_play", {card_arr:cards, card_player:username, next_player, hands_names: playerHand(newHands, db_room.players, ind)})
                        if(newHands.map(hand => hand.length).map(len => len === 0).reduce((acc, bool) => bool ? acc + 1 : acc) > 0){
                            io.to(player_id).emit("game_over");
                        }
                    }
                    updateRoomDB(name, {hands: newHands, center_card: [cards, username], current_players_turn: next_player} )
                } else {
                    io.to(client.id).emit("error", ["Invalid Card Combo"])
                }
            })
    })
    // Pass
    client.on("pass", ()=>{
        let name = uid_to_room[client.id];
        let username = uid_to_name[client.id];
        Room.findOne({name})
            .then(db_room => {
                if(db_room.current_players_turn !== username){
                    io.to(client.id).emit("error", ["Not your turn"])
                } else{
                    let client_ind = db_room.players.indexOf(username);
                    let next_player_ind = (client_ind + 1) % 4;
                    while(db_room.hands[next_player_ind].length === 0){
                        next_player_ind = (next_player_ind + 1) % 4
                    }
                    let next_player = db_room.players[next_player_ind];
                    for(let i = 0; i < 4; i++){
                        let player_id = name_to_uid[db_room.players[i]]
                        io.to(player_id).emit("player_turn", {player: next_player})
                    }
                    updateRoomDB(name, {current_players_turn: next_player})
                }
            })
    })

    client.on("disconnect", ()=>{
        if(uid_to_room[client.id]){
            console.log(`Disconnecting ${uid_to_name[client.id]} from ${uid_to_room[client.id]}`)
            disconnect_from_room(uid_to_room[client.id], uid_to_name[client.id]);
            delete(uid_to_room[client.id]);
        }
        delete(name_to_uid[uid_to_name[client.id]])
        delete(uid_to_name[client.id])
    })

    client.on("test", ()=>{

    })
})

const dbURI = process.env.MONGODBURI || require("./keys.js").mongoURI;
const port = process.env.PORT || 5000;
// mongoose.set();
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false})
    .then((result) => {
        Room.deleteMany({}, ()=> console.log("Cleared Rooms"))
        console.log('Connected to MongoDB')
        app.listen(port, ()=>console.log(`Server started on port ${port}`))
        server.listen(port+1);
    })
    .catch((err) => console.log(`Error: ${err}`));