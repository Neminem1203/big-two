import './App.css';

import React, {useReducer} from 'react';
import {reducer} from "./store";
import io from "socket.io-client";

import Login from "./components/login.js";
import Error from "./components/errors.js";
import Game from "./components/game.js";

let socket_url;
if (process.env.NODE_ENV === 'production') {
  socket_url = "https://big-two-mint.herokuapp.com/"
} else {
  socket_url = "localhost:5000"
}



const socket = io(`${socket_url}`, {
  transports: ["websocket", "polling"]
});


function App() {
  const [state, dispatch] = useReducer(reducer, {
    uuid: null, 
    username: null,
    rooms:[], 
    current_room: "",
    errors: []
  })
  window.state = state;
  let screen = <>Loading...</>
  if(state.uuid === null || state.uuid === undefined){
    // Login Phase
    screen = <Login dispatch={dispatch}/>
  } else {
    // Game Phase
    screen = <Game state={state} dispatch={dispatch} socket={socket}/>
  }
  return (
    <div className="App">
      {screen}
      <Error state={state} dispatch={dispatch}/>
    </div>
  );
}

export default App;
