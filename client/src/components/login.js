import React, {useState} from "react";
import {ACTIONS, loginUser} from "../store";


function Login(props){
    let [username, setUsername] = useState("");
    let [password, setPassword] = useState("");


    function handleSubmit(e){
        e.preventDefault();
        if(username === "" || password === "") return;
        props.dispatch({type: ACTIONS.ERROR, payload: {errors: []}})
        loginUser(username, password).then(res => {
            props.dispatch({type: ACTIONS.LOGIN, payload:{uuid: res.data.uuid, username:res.data.username, errors: res.data.errors}})
        });
    }

    function handleKeyDown(e){
        if(e.key === "Enter"){
            handleSubmit(e);
        }
    }
    return <div id="login-box">
        <label>Username: </label><input id="username" className="login-input" onChange={e => setUsername(e.target.value)} value={username} placeholder="username" onKeyDown={handleKeyDown}/>
        <label>Password: </label><input id="password" className="login-input" onChange={e => setPassword(e.target.value)} value={password} placeholder="password" type="password" onKeyDown={handleKeyDown}/>
        <button onClick={handleSubmit} >Register/Login</button>
    </div>
}

export default Login;