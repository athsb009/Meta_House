// socket.js
import io from "socket.io-client";

// Adjust the URL and options as needed for your environment.
const socket = io("http://localhost:3001/video");

export default socket;