const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RoomSchema = new Schema({
        // Room Name
    name:{ 
        type: String,
        required: true,
        minLength: 2,
    },  // UUIDs of all players
    players: { 
        type: Array
    },  // Highest Card Player + the UUID of the player who played it
    center_card: { 
        type: Array
    },  // The current player who can try to beat the center card
    current_players_turn: { 
        type: String
    },  // UUIDs and their Hands
    hands: { 
        type: Array
    }
}, {timestamps: true});

const Room = mongoose.model('Room', RoomSchema);
module.exports = Room;