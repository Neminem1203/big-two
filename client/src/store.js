const axios = require("axios");
const crypto = require('crypto');

export const ACTIONS = {
    LOGIN: "login",
    JOIN: "join_room",
    ERROR: "error",
    GET_ROOMS: "get_rooms",
  }
  
export function reducer(state, action){
    console.log(action);
    switch(action.type){
        case ACTIONS.LOGIN:
            return {...state, uuid: action.payload.uuid, username: action.payload.username, errors: action.payload.errors, current_room: undefined}
        case ACTIONS.JOIN:
            return {...state, current_room: action.payload.room_name, players: action.payload.players}
        case ACTIONS.GET_ROOMS:
            return {...state, rooms: action.payload.rooms}
        case ACTIONS.ERROR:
            return {...state, errors: action.payload.errors}
        default:
            return state
    }
}


export function loginUser(username, password) {

    const passHasher = crypto.createHash('md5');
    passHasher.update(Buffer.from(username+password, "utf-8"));
    let passHash = passHasher.digest('hex');
    return axios.post("/api/login", {
        username,
        password:passHash
    })
}

export function getAllRooms(){
    return axios.get("/api/get_rooms")
}

export function createNewRoom(name){
    return axios.post("/api/create_room", {
        name
    })
}

export function joinRoom(room_name, uuid){
    return axios.post("/api/join_room", {
        uuid,
        room_name
    })
}