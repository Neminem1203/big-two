import { io } from 'socket.io-client';

export const socket = io('http://localhost:5000', {withCredentials: true});
export let socketID = '';
socket.on('connect', () => {
    socketID = socket.id;
})