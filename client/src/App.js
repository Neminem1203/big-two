import './App.css';

import React, {useReducer} from 'react';
import {reducer} from "./store";
import io from "socket.io-client";

import Login from "./components/login.js";
import Error from "./components/errors.js";
import Game from "./components/game.js";

const socket = io(`http://localhost:${process.env.PORT+1}`, {
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
