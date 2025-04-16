const firebaseConfig = {
  apiKey: "AIzaSyBhfQ1Wf5JEy6sOU4ExXboRI4Ir4y_aKZw",
  authDomain: "easy-chatroom.firebaseapp.com",
  databaseURL: "https://easy-chatroom-default-rtdb.firebaseio.com",
  projectId: "easy-chatroom",
  storageBucket: "easy-chatroom.firebasestorage.app",
  messagingSenderId: "985049198428",
  appId: "1:985049198428:web:d0eb7e2de39887710c9b99",
  measurementId: "G-QDESJ2WR42"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let roomCode = null;
let clientId = "_" + Math.random().toString(36).substr(2, 9);
let lastActivity = Date.now();
let typingTimeout;
let gr8stg = "";
const STATIC_ROOM = "050BBB66HH";
const MAX_MESSAGES = 500;

// AUDIO setup
const sound = new Audio("https://notificationsounds.com/notification-sounds/eventually-590/download/mp3");
sound.volume = 0.3;

// INIT
window.onload = () => {
  cleanupOldRooms();
  setupSidebarBackHandler();
  initUsernameFlow();
  setupVisibilityAttention();
};

function sanitizeUsername(name) {
  return name.replace(/[.#$\[\]]/g, "_");
}
function submitProfile() {
  const name = document.getElementById("profileUsernameInput").value.trim();
  const desc = document.getElementById("profileDescriptionInput").value.trim();
  const error = document.getElementById("profileError");

  if (!name) {
    error.style.display = "block";
    return;
  }

  error.style.display = "none";
  username = name;
  const timestamp = Date.now();
  const sanitized = sanitizeUsername(name);

  // Save in Firebase user profile
  const profileRef = db.ref(`profiles/${sanitized}`);
  profileRef.get().then(snap => {
    const data = snap.val() || {};
    const history = data.usernameHistory || [];

    // Only add to history if changed
    if (!history.includes(name)) history.push(name);

    profileRef.set({
      username: name,
      description: desc,
      lastChanged: timestamp,
      usernameHistory: history
    });

    localStorage.setItem("chat_username", name);
    localStorage.setItem("profile_description", desc);

    document.getElementById("namePreview").innerText = username;
    showScreen("roomChoiceScreen");
  });
}
function saveUsername() {
  const input = document.getElementById("usernameInput").value.trim();
  if (!input) return alert("Please enter a valid name");

  username = input;
  localStorage.setItem("chat_username", username);
  initUsernameFlow();
}

function generateRoom() {
  roomCode = genRoomCode();
  db.ref("rooms/" + roomCode).set({ active: true, created: Date.now() });
  startChat();
}
function joinRoom() {
  const inputCode = (roomCode || document.getElementById("roomCodeInput").value.trim().toUpperCase());
  if (!inputCode) return alert("Enter a valid room code");
  roomCode = inputCode;

  // Static room flow → show password screen first
  if (roomCode === STATIC_ROOM) {
    showScreen("passwordScreen");
    return;
  }

  // Regular room
  db.ref("rooms/" + roomCode).get().then(snap => {
    if (snap.exists() && snap.val().active !== false) {
      startChat();
    } else {
      alert("Room doesn't exist or is inactive.");
    }
  });
}
function startChat() {
  if (!roomCode || !username) {
    alert("Missing room or user information.");
    return showScreen("roomChoiceScreen");
  }

  showScreen("chatScreen");
  document.getElementById("userDisplay").innerText = username;
  if(roomCode = "050BBB66HH")
  {
    document.getElementById("roomDisplay").innerText = "No room code available for private rooms";
  }
  else
  {
    document.getElementById("roomDisplay").innerText = roomCode;
  }
  listenForMessages();
  listenForTyping();
  startInactivityTimer();
  trackPresence();
  listenForUserList();
}

function validateStaticRoomPassword() {
  const entered = document.getElementById("staticPasswordInput").value;
  const errorText = document.getElementById("passwordError");

  db.ref("gr8stg").get().then(snap => {
    const password = snap.val();
    if (entered === password) {
      errorText.style.display = "none";
      startChat();
    } else {
      errorText.style.display = "block";
    }
  });
}

function sendMessage() {
  const input = document.getElementById("msgInput");
  const msg = input.value.trim();
  if (!msg) return;

  const key = db.ref().push().key;
  db.ref(`rooms/${roomCode}/messages/${key}`).set({
    msg,
    sender: username,
    senderId: clientId,
    timestamp: Date.now()
  });

  input.value = '';
  sendTyping(true);
  lastActivity = Date.now();
}

function listenForMessages() {
  const roomRef = db.ref(`rooms/${roomCode}/messages`);
  const query = roomRef.limitToLast(MAX_MESSAGES);

  query.on("child_added", (snap) => {
    const { msg, sender, senderId, timestamp } = snap.val();
    const sent = senderId === clientId;
    addMessage(msg, sender, timestamp, sent);

    // Only auto-delete in non-static rooms
    if (roomCode !== STATIC_ROOM) {
      db.ref(`rooms/${roomCode}/messages/${snap.key}`).remove();
    }

    // Notify
    if (!sent) {
      sound.play();
      flagPageAttention();
    }
  });
}

function addMessage(text, sender, timestamp, sent) {
  const div = document.createElement("div");
  div.classList.add("msg", sent ? "sent" : "received");

  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `<span class="sender-name">${sender}</span><br>${text}<small>${time}</small>`;

  const msgBox = document.getElementById("messages");
  msgBox.appendChild(div);
  msgBox.scrollTop = msgBox.scrollHeight;
}
function closeProfile() {
  document.getElementById("profileViewer").style.display = "none";
}

function cleanupOldRooms() {
  db.ref("rooms").once("value").then(snapshot => {
    const rooms = snapshot.val();
    if (!rooms) return;
    const now = Date.now();
    for (const code in rooms) {
      if (code === STATIC_ROOM) continue;
      const room = rooms[code];
      if (now - (room.created || 0) > 2 * 60 * 1000) {
        db.ref("rooms/" + code).remove();
      }
    }
  });
}
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("msgInput");
  if (input) {
    input.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
      }
    });
  }
});
function showScreen(id) {
  ["usernameScreen", "roomChoiceScreen", "codeEntryScreen", "chatScreen", "passwordScreen", "profileScreen"].forEach(s => {
    document.getElementById(s).style.display = "none";
  });
  document.getElementById(id).style.display = "flex";
}

function genRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const get = (set, len) => Array.from({ length: len }, () => set[Math.floor(Math.random() * set.length)]).join('');
  return get(digits, 3) + get(chars, 3) + get(digits, 2) + get(chars, 2);
}

function startInactivityTimer() {
  setInterval(() => {
    if (Date.now() - lastActivity > 5 * 60 * 1000 && roomCode !== STATIC_ROOM) {
      db.ref("rooms/" + roomCode).update({ active: false });
      alert("Session expired.");
      location.reload();
    }
  }, 30000);
}

function setupSidebarBackHandler() {
  window.addEventListener("popstate", () => {
    const sidebar = document.getElementById("userSidebar");
    if (sidebar?.classList.contains("show")) {
      sidebar.classList.remove("show");
    }
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById("userSidebar");
  if (!sidebar.classList.contains("show")) {
    sidebar.classList.add("show");
    history.pushState({ sidebarOpen: true }, "");
  } else {
    sidebar.classList.remove("show");
    if (history.state?.sidebarOpen) history.back();
  }
}

function setupVisibilityAttention() {
  let unread = 0;
  let originalTitle = document.title;

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      document.title = originalTitle;
      unread = 0;
    }
  });

  window.flagPageAttention = function () {
    if (document.hidden) {
      unread++;
      document.title = `(${unread}) New message • ${originalTitle}`;
    }
  };
}
let username = null;
function tryEditProfile() {
  const sanitized = sanitizeUsername(username);
  db.ref(`profiles/${sanitized}`).get().then(snap => {
    const data = snap.val();
    if (!data) return alert("Profile not found.");

    const last = data.lastChanged || 0;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (now - last < oneDay) {
      const left = Math.ceil((oneDay - (now - last)) / (60 * 1000));
      alert(`You can change your profile again in ${left} minutes.`);
    } else {
      showScreen("profileScreen");
      document.getElementById("profileUsernameInput").value = username;
      document.getElementById("profileDescriptionInput").value = data.description || "";
    }
  });
}

function listenForUserList() {
  db.ref(`users/${roomCode}`).on("value", snap => {
    const users = snap.val() || {};
    const now = Date.now();
    const html = Object.values(users).map(user => {
      const isOnline = user.online;
      const seen = now - user.lastOnline <= 30 * 60 * 1000;
      if (!isOnline && !seen) return "";

      const color = isOnline ? "#00ff88" : "#888";
      const status = isOnline ? "🟢" : "🕒";
      const lastSeen = new Date(user.lastOnline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `<li style="color:${color};cursor:pointer;" onclick="viewProfile('${sanitizeUsername(user.username)}')">${status} ${user.username}</li>`;
    }).join("");
    document.getElementById("userList").innerHTML = html;
  });
}
function sendTyping(stop = false) {
  const path = `rooms/${roomCode}/typing/${clientId}`;
  if (stop) {
    db.ref(path).remove();
  } else {
    db.ref(path).set(username);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      db.ref(path).remove();
    }, 3000);
  }
}

function listenForTyping() {
  const el = document.getElementById("typing");
  db.ref(`rooms/${roomCode}/typing`).on("value", snap => {
    const data = snap.val();
    if (!data) return (el.innerText = "");
    const others = Object.values(data).filter(name => name !== username);
    el.innerText = others.length ? `${others.join(", ")} typing...` : "";
  });
}

function trackPresence() {
  if (!username || !roomCode) return;
  const userKey = sanitizeUsername(username);
  const userRef = db.ref(`users/${roomCode}/${userKey}`);

  const data = {
    username,
    lastOnline: firebase.database.ServerValue.TIMESTAMP,
    online: true
  };

  userRef.set(data);
  userRef.onDisconnect().update({
    online: false,
    lastOnline: Date.now()
  });
}
function viewProfile(userKey) {
  db.ref(`profiles/${userKey}`).get().then(snap => {
    if (!snap.exists()) return;
    const p = snap.val();
    const content = `
Name: ${p.username}
Description: ${p.description || "No bio set"}
History:
${(p.usernameHistory || []).join("\n")}
Last Changed: ${new Date(p.lastChanged).toLocaleString()}
    `.trim();
    document.getElementById("profileContent").innerText = content;
    document.getElementById("profileViewer").style.display = "block";
  });
}
function initUsernameFlow() {
  const stored = localStorage.getItem("chat_username");

  if (!stored) {
    showScreen("profileScreen");
  } else {
    username = stored;
    document.getElementById("namePreview").innerText = username;
    showScreen("roomChoiceScreen");
  }
}