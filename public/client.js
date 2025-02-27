var connectedUser;
var conn = new WebSocket('wss://fire-szr5.onrender.com');

conn.onopen = function () {
  console.log("Connected to the signaling server");
  fetchUserData();
};

conn.onmessage = function (msg) {
  console.log("Got message", msg.data);
  var data = JSON.parse(msg.data);

  switch (data.type) {
    case "login":
      handleLogin(data.success);
      break;
    case "offer":
      handleOffer(data.offer, data.name);
      break;
    case "answer":
      handleAnswer(data.answer);
      break;
    case "candidate":
      handleCandidate(data.candidate);
      break;
    case "leave":
      handleLeave();
      break;
    case "active_users":
      updateActiveUsersList(data.users);
      break;
    default:
      break;
  }
};

conn.onerror = function (err) {
  console.log("Got error", err);
};

// Send JSON messages
function send(message) {
  if (connectedUser) {
    message.name = connectedUser;
  }
  conn.send(JSON.stringify(message));
}

// UI elements
var loginPage = document.querySelector('#loginPage');
var usernameInput = document.querySelector('#usernameInput');
var loginBtn = document.querySelector('#loginBtn');

var callPage = document.querySelector('#callPage');
var callToUsernameInput = document.querySelector('#callToUsernameInput');
var callBtn = document.querySelector('#callBtn');

var hangUpBtn = document.querySelector('#hangUpBtn');
var localAudio = document.querySelector('#localAudio');
var remoteAudio = document.querySelector('#remoteAudio');
var activeUsersList = document.querySelector('#activeUsersList');
var allUsersList = document.querySelector('#allUsersList');

var yourConn;
var stream;

callPage.style.display = "none";

// Login user
loginBtn.addEventListener("click", function () {
  let name = usernameInput.value;

  if (name.length > 0) {
    send({
      type: "login",
      name: name
    });
  }
});

function handleLogin(success) {
  if (!success) {
    alert("Ooops...try a different username");
  } else {
    loginPage.style.display = "none";
    callPage.style.display = "block";

    // Request microphone access
    navigator.mediaDevices.getUserMedia({ video: false, audio: true })
      .then(function (myStream) {
        stream = myStream;

        // Ensure audio is enabled
        stream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });

        localAudio.srcObject = stream;

        // Configure STUN/TURN servers
        var configuration = {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            {
              urls: "turn:your.turn.server:3478",
              username: "your_username",
              credential: "your_password"
            }
          ]
        };

        yourConn = new RTCPeerConnection(configuration);

        // Add audio tracks to connection
        stream.getTracks().forEach(track => {
          yourConn.addTrack(track, stream);
        });

        // Listen for remote stream
        yourConn.ontrack = function (event) {
          console.log("Remote track added:", event.streams);
          remoteAudio.srcObject = event.streams[0];
        };

        // ICE candidate handling
        yourConn.onicecandidate = function (event) {
          if (event.candidate) {
            console.log("Sending ICE Candidate:", event.candidate);
            send({
              type: "candidate",
              candidate: event.candidate
            });
          } else {
            console.log("No more ICE candidates.");
          }
        };
      })
      .catch(function (error) {
        console.log("Error accessing media devices:", error);
      });
  }
}

// Make a call
callBtn.addEventListener("click", function () {
  if (!yourConn) {
    alert("Connection not initialized yet.");
    return;
  }

  var callToUsername = callToUsernameInput.value;

  if (callToUsername.length > 0) {
    connectedUser = callToUsername;

    yourConn.createOffer()
      .then(function (offer) {
        console.log("Offer created:", offer);
        return yourConn.setLocalDescription(offer);
      })
      .then(function () {
        send({
          type: "offer",
          offer: yourConn.localDescription
        });
      })
      .catch(function (error) {
        console.error("Error when creating an offer:", error);
      });
  }
});

// Handle offer
// function handleOffer(offer, name) {
//   connectedUser = name;
//   yourConn.setRemoteDescription(new RTCSessionDescription(offer))
//     .then(() => {
//       console.log("Remote description set");
//       return yourConn.createAnswer();
//     })
//     .then(answer => {
//       return yourConn.setLocalDescription(answer);
//     })
//     .then(() => {
//       console.log("Answer created:", yourConn.localDescription);
//       send({
//         type: "answer",
//         answer: yourConn.localDescription
//       });
//     })
//     .catch(error => {
//       console.error("Error when handling an offer:", error);
//     });
// }


function handleOffer(offerString, name) {
  try {
    const offer = typeof offerString === "string" ? JSON.parse(offerString) : offerString;
    
    if (!offer.sdp || !offer.type) {
      throw new Error("Invalid SDP offer format");
    }

    connectedUser = name;
    
    yourConn.setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => {
        console.log("Remote description set");
        return yourConn.createAnswer();
      })
      .then(answer => {
        return yourConn.setLocalDescription(answer);
      })
      .then(() => {
        console.log("Answer created:", yourConn.localDescription);
        send({
          type: "answer",
          answer: yourConn.localDescription
        });
      })
      .catch(error => {
        console.error("Error when handling an offer:", error);
      });
  } catch (error) {
    console.error("Error parsing offer:", error);
  }
}





// Handle answer
// function handleAnswer(answer) {
//   console.log("Answer received:", answer);
//   yourConn.setRemoteDescription(new RTCSessionDescription(answer))
//     .catch(error => console.error("Error setting remote description:", error));
// }


function handleAnswer(answer) {
  try {
    if (typeof answer === "string") {
      answer = JSON.parse(answer); // Parse JSON String to Object
    }
    console.log("Answer received:", answer);
    if (answer.sdp) {
      yourConn.setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => console.log("Remote description set successfully"))
        .catch(error => console.error("Error setting remote description:", error));
    } else {
      console.error("SDP is missing in answer.");
    }
  } catch (e) {
    console.error("Error parsing answer:", e);
  }
}






// Handle ICE candidate
// function handleCandidate(candidate) {
//   console.log("ICE candidate received:", candidate);
//   yourConn.addIceCandidate(new RTCIceCandidate(candidate))
//     .catch(error => console.error("Error adding ICE candidate:", error));
// }

function handleCandidate(candidate) {
  console.log("Received ICE Candidate:", candidate);

  if (yourConn) {
    yourConn.addIceCandidate(new RTCIceCandidate(candidate))
      .then(() => console.log("ICE Candidate added successfully"))
      .catch(error => console.error("Error adding ICE Candidate:", error));
  } else {
    console.warn("RTCPeerConnection not initialized. Candidate not added.");
  }
}




// Hang up
hangUpBtn.addEventListener("click", function () {
  send({
    type: "leave"
  });

  handleLeave();
});

// Handle leave
function handleLeave() {
  connectedUser = null;
  remoteAudio.srcObject = null;

  if (yourConn) {
    yourConn.close();
    yourConn.onicecandidate = null;
    yourConn.ontrack = null;
  }
}

// Fetch users from server
function fetchUserData() {
  fetch('https://fire-szr5.onrender.com/getusers')
    .then(response => response.json())
    .then(users => {
      updateAllUsersList(users);
    })
    .catch(error => console.error('Error fetching user data:', error));
}

// Update active users list
function updateActiveUsersList(users) {
  activeUsersList.innerHTML = "";
  users.forEach(user => {
    var li = document.createElement("li");
    li.textContent = user;
    li.className = "list-group-item";
    activeUsersList.appendChild(li);
  });
}

// Update all users list
function updateAllUsersList(users) {
  allUsersList.innerHTML = "";
  users.forEach(user => {
    var li = document.createElement("li");
    li.textContent = `${user.name} (${user.email})`;
    li.className = "list-group-item";
    allUsersList.appendChild(li);
  });
}
