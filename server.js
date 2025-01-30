const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const allroutes = require('./allroutes.js');

// Create an Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Create an HTTP server
const server = http.createServer(app);

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

// Keep track of connected users
const users = {};

// Define a User schema and model
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    // Add other fields as needed
});

const User = mongoose.model('User', userSchema);

// Handle WebSocket connections
wss.on('connection', (connection) => {
    console.log('User connected');

    // Handle incoming messages
    connection.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log('Invalid JSON');
            sendTo(connection, { type: 'error', message: 'Invalid JSON format' });
            return;
        }

        // Process the message
        switch (data.type) {
            case 'login':
                console.log('User logged:', data.name);
                if (users[data.name]) {
                    sendTo(connection, { type: 'login', success: false });
                } else {
                    users[data.name] = connection;
                    connection.name = data.name;
                    sendTo(connection, { type: 'login', success: true });
                    broadcastActiveUsers();
                }
                break;

            case 'offer':
                console.log('Sending offer to:', data.name);
                const connOffer = users[data.name];
                if (connOffer) {
                    connection.otherName = data.name;
                    sendTo(connOffer, { type: 'offer', offer: data.offer, name: connection.name });
                } else {
                    sendTo(connection, { type: 'error', message: `User ${data.name} not found` });
                }
                break;

            case 'answer':
                console.log('Sending answer to:', data.name);
                const connAnswer = users[data.name];
                if (connAnswer) {
                    connection.otherName = data.name;
                    sendTo(connAnswer, { type: 'answer', answer: data.answer });
                } else {
                    sendTo(connection, { type: 'error', message: `User ${data.name} not found` });
                }
                break;

            case 'candidate':
                console.log('Sending candidate to:', data.name);
                const connCandidate = users[data.name];
                if (connCandidate) {
                    sendTo(connCandidate, { type: 'candidate', candidate: data.candidate });
                } else {
                    sendTo(connection, { type: 'error', message: `User ${data.name} not found` });
                }
                break;

            case 'leave':
                console.log('Disconnecting from', data.name);
                const connLeave = users[data.name];
                if (connLeave) {
                    connLeave.otherName = null;
                    sendTo(connLeave, { type: 'leave' });
                }
                break;

            default:
                sendTo(connection, { type: 'error', message: `Command not found: ${data.type}` });
                break;
        }
    });

    connection.on('close', () => {
        if (connection.name) {
            delete users[connection.name];
            broadcastActiveUsers();
            if (connection.otherName) {
                console.log('Disconnecting from', connection.otherName);
                const conn = users[connection.otherName];
                if (conn) {
                    conn.otherName = null;
                    sendTo(conn, { type: 'leave' });
                }
            }
        }
    });

    connection.send(JSON.stringify({ message: 'Connection established' }));
});

const dbURI = 'mongodb+srv://touchzinginterns:CnMCfSG9v2x8cBi8@cluster0.tznnk.mongodb.net/iosdatabase';

// Connect to MongoDB Atlas
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch((err) => console.error('Error connecting to MongoDB Atlas', err));

// Send a JSON message to the WebSocket client
function sendTo(connection, message) {
    try {
        connection.send(JSON.stringify(message));
    } catch (e) {
        console.error('Error sending message:', e);
    }
}

// Broadcast the list of active users to all connected clients
function broadcastActiveUsers() {
    const userList = Object.keys(users);
    for (let user in users) {
        sendTo(users[user], { type: 'active_users', users: userList });
    }
}

// Endpoint to fetch user data from the database
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.use(allroutes);



// Start the server
const PORT = process.env.PORT || 9090;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});


