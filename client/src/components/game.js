import {useEffect, useState, useCallback} from "react";
import { ACTIONS, createNewRoom, getAllRooms } from "../store";


const suits = ["D", "C", "H", "S"];
const numbers = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];

const backOfCard = <img className="card noselect" src={`cards/RED_BACK.svg`} alt="Red Card Back"/>

const PAGE_LIMIT = 8;

export default function Game(props){
    // forceUpdate
    const [, updateState] = useState();
    const forceUpdate = useCallback(() => updateState({}), []); 
    // socket
    const socket = props.socket;
    let [lobbyPage, setLobbyPage] = useState(0); // lobby pages
    let [newRoomName, setNewRoomName] = useState(""); //room name input
    let [allPlayers, setAllPlayers] = useState(["You", "Right Opponent", "", "Left Opponent"]); // player names
    let [turnIndicatorInd, setTurnIndicatorInd] = useState(0); // just for the spinning animation
    let [centerCards, setCenterCards] = useState(null); // center card to fan out
    let [centerPlayer, setCenterPlayer] = useState(0);
    let [cardsToPlay, setCardsToPlay] = useState({}); // cards to play. all false = pass
    let [hand, setHand] = useState([[0,1,2,3], 1, 1, 1]); // your hand + lengths of the other players

    // clears the error box
    function clearErrors(){
        props.dispatch({type: ACTIONS.ERROR, payload: {errors:[]}});
    }
    // handles create room button event
    function createRoomButton(){
        clearErrors();
        if(newRoomName.length > 1){
            createNewRoom(newRoomName)
                .then(res => {
                    handleJoinRoom(res.data.room)
                    refreshButton();
            })
            setNewRoomName("");
        } else{
            props.dispatch({type: ACTIONS.ERROR, payload: {errors: ["Room name must be greater than 1 character"]}})
        }
    }
    // handles refresh button event
    function refreshButton(){
        clearErrors();
        getAllRooms().then(res => {
            props.dispatch({type: ACTIONS.GET_ROOMS, payload: {rooms: res.data.rooms}})
        })
    }
    // handles the join room event
    function handleJoinRoom(room_name){
        clearErrors();
        socket.emit("join_room", room_name);
    }
    // create room on enter key
    function handleCreateRoomEnter(e){
        if(e.key === "Enter"){
            createRoomButton();
        }
    }
    // toggles the cards that you will play
    function toggleCard(id){
        let newCardsToPlay = cardsToPlay;
        newCardsToPlay[id] = !newCardsToPlay[id];
        setCardsToPlay(newCardsToPlay);
        forceUpdate();
    }
    // resets cards to play
    function reset(){
        let newCardsToPlay = {}
        hand[0].forEach(card_id => newCardsToPlay[card_id] = false);
        setCardsToPlay(newCardsToPlay);
    }
    function findAndSetPlayerTurn(player){
        for(let i = 0; i < 4; i++){
            if(player === allPlayers[i]){
                debugger
                let newTurnInd = turnIndicatorInd
                while(newTurnInd%4 != i){
                    newTurnInd += 1
                }
                setTurnIndicatorInd(newTurnInd);
                break;
            }
        }
    }

    // returns the div card
    function cardFace(id){
        let val = numbers[Math.floor(id/4)];
        let suit = suits[id%4];
        let cardClass = "card";
        if(cardsToPlay[id]){
            cardClass += " active";
        }
        return <img className={cardClass} key={`cardId${id}`} src={`cards/${val}${suit}.svg`} onClick={()=>toggleCard(id)} alt={`${val}${suit}`}/>
    }
    // plays the current hand and send it to the server
    function playHand(){
        let sendCards = [];
        let playersHand = hand[0];
        for(let i = 0; i < playersHand.length; i++){
            if(cardsToPlay[playersHand[i]]){
                sendCards.push(playersHand[i]);
            } 
        }
        reset();
        if(sendCards.length === 0){
            socket.emit("pass");
        } else{
            socket.emit("play_cards", sendCards)
        }
    }
    // on component mount
    useEffect(()=>{
        refreshButton();
        // sets the connection between the server
        socket.emit("login", props.state.username);
        // occurs when logged in else where or server restart
        socket.on("force_logout", ()=>{
            props.dispatch({type: ACTIONS.LOGIN, payload: {uuid: null, username: null, errors: ["Expired Session"]}})
        })
        // join room action
        socket.on("join_room", ({room_name, players})=>{
            props.dispatch({type: ACTIONS.JOIN, payload: {room_name}})
            if(players){ // joined a game room
                let newAllPlayers = [];
                let ind = 0;
                while(players[ind] !== props.state.username){
                    ind += 1;
                }
    
                for(let i = 0; i < 4; i++){
                    newAllPlayers.push(players[ind+i%4]);
                }
                setAllPlayers(newAllPlayers);
            }
        })
        socket.on("setup", ({playerNames, hands, first_player}) =>{
            console.log(playerNames, hands, first_player);
            setAllPlayers(playerNames);
            setHand(hands);
            setCenterCards([]);
            let newTurnInd = turnIndicatorInd;
            for(let i = 0; i < 4; i++){
                if(first_player === playerNames[i]){
                    while(newTurnInd%4 != i){
                        newTurnInd += 1
                    }
                    setTurnIndicatorInd(newTurnInd);
                    setCenterPlayer(newTurnInd);
                    break;
                }
            }
        })
        socket.on("card_play", ({card_arr, card_player, next_player, hands_names}) =>{
            let [hands, names] = hands_names;
            console.log(hands);
            setCenterCards(card_arr);
            setHand(hands);
            for(let i = 0; i < 4; i++){
                if(next_player === names[i]){
                    let newTurnIndicator = turnIndicatorInd;
                    while(newTurnIndicator%4 != i){
                        newTurnIndicator += 1;
                    }
                    setTurnIndicatorInd(newTurnIndicator);
                }
                if(card_player === names[i]){
                    let newCenterInd = centerPlayer
                    while(newCenterInd%4 !== i){
                        newCenterInd += 1
                    }
                    setCenterPlayer(newCenterInd);
                }
            }
        })
        // get names of all players
        socket.on("player_names", player_names => {
            setAllPlayers(player_names);
        })
        // get hand and the length of the other players hands
        socket.on("player_hands", player_hands => {
            setHand(player_hands);
        })
        // Someone played a card
        // socket.on("center_card", ({card_arr, player}) =>{
        //     findAndSetCenterPlayer(player);
        //     setCenterCards(card_arr);
        // })
        // Set the player turn
        socket.on("player_turn", player=>{
            setTurnIndicatorInd(oldInd => oldInd+1)
        })
        socket.on("game_over", ()=>{
            props.dispatch({type: ACTIONS.ERROR, errors:["Game Over"]});
        })
        // errors
        socket.on("error", errors=>{
            props.dispatch({type: ACTIONS.ERROR, payload: {errors}})
        })
    }, [])

    let render = <div>Loading Lobby...</div>
    let header_info = [<div onClick={()=>socket.emit("debugging")}>Username: {props.state.username}</div>];
    let buttons = <div></div>
    if(props.state.current_room === "" || props.state.current_room === undefined){
        // Get all the rooms. Get All Rooms
        let maxPages = Math.ceil(props.state.rooms.length/PAGE_LIMIT)
        function prevPage(){
            if(lobbyPage > 0){
                setLobbyPage(prevPage=>prevPage-1)
            }
        }
        function nextPage(){
            if(lobbyPage < maxPages-1){
                setLobbyPage(prevPage=>prevPage+1)
            }
        }
        render = <div id="lobby">
            <div id="lobby-header"> 
                <div>
                    <label>Lobbies</label>
                </div>
                <div id="text_and_refresh">
                <input id="new-room-name" onChange={e => setNewRoomName(e.target.value)} value={newRoomName} placeholder="New Room Name" onKeyDown={handleCreateRoomEnter}/> 
                <img id="refresh" src={process.env.PUBLIC_URL + "refresh.png"} alt="refresh button" onClick={refreshButton}/>
                </div>
                <div id="new-room-button" onClick={()=>createRoomButton()}>Create New Room</div>
            </div>
            <div id="lobby-body">
                {props.state.rooms.slice(lobbyPage*PAGE_LIMIT, (lobbyPage+1)*PAGE_LIMIT)
                .map(room_name => <div key={`room-${room_name}`} className="room" onClick={()=>handleJoinRoom(room_name)}> {room_name} </div>)}
                <div className="lobby-pages">
                    <div onClick={prevPage} className="lobby-button">Prev</div>
                    <input value={lobbyPage+1} onChange={e=>{
                        e.preventDefault();
                        setLobbyPage(e.target.value-1);
                    }} style={{width: "20px"}}></input> of {maxPages} 
                    
                    <div onClick={nextPage} className="lobby-button">Next</div>
                </div>
            </div>
        </div>
    } else {
        let center = <div id="start-game-btn" onClick={()=>socket.emit("start_game", props.state.current_room)}>Start Game</div>
        if(centerCards !== null){
            center = <div id="center-card" className="hand hhand-compact">{centerCards.map(card_ind => cardFace(card_ind))}</div>
            buttons = <div id="player-buttons">
            <div className="hand-button" onClick={()=>playHand()}>{Object.values(cardsToPlay).every(bool => !bool) ? "Pass" : "Play"}</div>
            <div className="hand-button" onClick={()=>reset()}>Reset</div>
        </div>
        }
        // Currently in a game. Get Current Room
        header_info.push(<div> Room: {props.state.current_room}</div>)
        header_info.push(<div onClick={()=>handleJoinRoom("")} id="leave-room">Leave</div>)
        render = <div> 
            <div id="game-body">
                <div id="opposite-hand" className="hand hhand-compact noselect">
                    <div className="name-plate noselect">{allPlayers[2]} {hand[2]}</div>
                    {Array(hand[2]).fill(backOfCard)}
                </div>
                <div id="middle-board">
                    <div id="left-hand" className="hand hhand-compact noselect">
                        <div className="name-plate noselect">{allPlayers[3]} {hand[3]}</div>
                        {Array(hand[3]).fill(backOfCard)}
                    </div>
                    <div>
                        {center}
                        <img src="AoSArrowB.png" alt="Ace of Space Turn Indicator" className="turn-indicator noselect" style={{transform: `rotate(${180-90*turnIndicatorInd}deg)`, zIndex: 2}} />
                        <img src="AoSArrowR.png" alt="Center Card Player" className="turn-indicator noselect" style={{transform: `rotate(${180-90*centerPlayer}deg)`,}} />
                    </div>
                    <div id="right-hand" className="hand hhand-compact noselect">
                        <div className="name-plate noselect">{allPlayers[1]} {hand[1]}</div>
                        {Array(hand[1]).fill(backOfCard)}
                    </div>
                </div>
                <div id="players-area">
                    {buttons}
                    <div id="current-hand" className="hand hhand-compact active-hand">
                        {hand[0].map(card_ind => cardFace(card_ind))}
                    </div>
                </div>
            </div>
        </div>
    }
    return <div>
        <div id="game-header">
            {header_info.map(header_div => header_div)}
        </div>
        {render}
    </div>;
}