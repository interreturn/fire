var name;
var connectedUser;

// Connecting to our signaling server
var conn = new WebSocket('ws://localhost:9090');

conn.onopen = function () {
  console.log("Connected to the signaling server");
  fetchUserData();
};

// When we got a message from a signaling server
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

// Alias for sending JSON encoded messages
function send(message) {
  if (connectedUser) {
    message.name = connectedUser;
  }
  conn.send(JSON.stringify(message));
}

// UI selectors block
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

// Login when the user clicks the button
loginBtn.addEventListener("click", function (event) {
  name = usernameInput.value;

  if (name.length > 0) {
    send({
      type: "login",
      name: name
    });
  }
});

function handleLogin(success) {
  if (success === false) {
    alert("Ooops...try a different username");
  } else {
    loginPage.style.display = "none";
    callPage.style.display = "block";

    // Starting a peer connection
    navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then(function (myStream) {
      stream = myStream;

      // Displaying local audio stream on the page
      localAudio.srcObject = stream;

      // Using Google public stun server
      var configuration = {
        iceServers: [{ urls: "stun:stun2.1.google.com:19302" }]
      };

      yourConn = new RTCPeerConnection(configuration);

      // Setup stream listening
      yourConn.addStream(stream);

      // When a remote user adds stream to the peer connection, we display it
      yourConn.onaddstream = function (e) {
        remoteAudio.srcObject = e.stream;
      };

      // Setup ice handling
      yourConn.onicecandidate = function (event) {
        if (event.candidate) {
          send({
            type: "candidate",
            candidate: event.candidate
          });
        }
      };

    }).catch(function (error) {
      console.log(error);
    });
  }
}

// Initiating a call
callBtn.addEventListener("click", function () {
  if (!yourConn) {
    alert("Connection not initialized yet.");
    return;
  }

  var callToUsername = callToUsernameInput.value;

  if (callToUsername.length > 0) {
    connectedUser = callToUsername;

    // Create an offer
    yourConn.createOffer().then(function (offer) {
      send({
        type: "offer",
        offer: offer
      });

      yourConn.setLocalDescription(offer);
    }).catch(function (error) {
      alert("Error when creating an offer");
    });
  }
});

// When somebody sends us an offer
function handleOffer(offer, name) {
  connectedUser = name;
  yourConn.setRemoteDescription(new RTCSessionDescription(offer)).then(function () {
    return yourConn.createAnswer();
  }).then(function (answer) {
    return yourConn.setLocalDescription(answer);
  }).then(function () {
    send({
      type: "answer",
      answer: yourConn.localDescription
    });
  }).catch(function (error) {
    alert("Error when creating an answer");
  });
}

// When we got an answer from a remote user
function handleAnswer(answer) {
  yourConn.setRemoteDescription(new RTCSessionDescription(answer));
}

// When we got an ice candidate from a remote user
function handleCandidate(candidate) {
  yourConn.addIceCandidate(new RTCIceCandidate(candidate));
}

// Hang up
hangUpBtn.addEventListener("click", function () {
  send({
    type: "leave"
  });

  handleLeave();
});

function handleLeave() {
  connectedUser = null;
  remoteAudio.srcObject = null;

  yourConn.close();
  yourConn.onicecandidate = null;
  yourConn.onaddstream = null;
}

// Update the list of active users
function updateActiveUsersList(users) {
  activeUsersList.innerHTML = "";
  users.forEach(function (user) {
    var li = document.createElement("li");
    li.textContent = user;
    li.className = "list-group-item";
    activeUsersList.appendChild(li);
  });
}

// Fetch user data from the server
function fetchUserData() {
  fetch('http://localhost:9090/getusers')
    .then(response => response.json())
    .then(users => {
      updateAllUsersList(users);
    })
    .catch(error => console.error('Error fetching user data:', error));
}

// Update the list of all users
function updateAllUsersList(users) {
  allUsersList.innerHTML = "";
  users.forEach(function (user) {
    var li = document.createElement("li");
    li.textContent = `${user.name} (${user.email})`;
    li.className = "list-group-item";
    allUsersList.appendChild(li);
  });
}