const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

// Create an Express app
const app = express();

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Create an HTTP server
const server = http.createServer(app);

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

// Keep track of connected users
const users = {};

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

// Send a JSON message to the WebSocket client
function sendTo(connection, message) {
    try {
        connection.send(JSON.stringify(message));
    } catch (e) {
        console.error('Error sending message:', e);
    }
}

// Start the server
const PORT = process.env.PORT || 9090;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
