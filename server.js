const express = require("express");
const cors = require("cors");
const path = require("path");
const { v4: uuid } = require("uuid");
const { WebSocketServer } = require("ws");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // truy cập file tĩnh

// =======================
//  DATABASE GIẢ • LƯU TRONG RAM
// =======================
const users = {};   // username -> { password, userId }
const onlineUsers = {}; // userId -> username

// =======================
//    API: ĐĂNG KÝ
// =======================
app.post("/register", (req, res) => {
  const { username, password } = req.body;

  if (users[username]) return res.json({ status: "error", message: "User already exists" });

  const userId = uuid();
  users[username] = { password, userId };
  res.json({ status: "ok", userId });
});

// =======================
//    API: ĐĂNG NHẬP
// =======================
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!users[username]) return res.json({ status: "error", message: "Wrong username" });
  if (users[username].password !== password) return res.json({ status: "error", message: "Wrong password" });

  res.json({ status: "ok", userId: users[username].userId });
});

// =======================
//    API: TÌM KIẾM USERNAME
// =======================
app.get("/search", (req, res) => {
  const q = req.query.q?.toLowerCase() || "";

  const result = Object.keys(users).filter(username =>
    username.toLowerCase().includes(q)
  );

  res.json({ status: "ok", result });
});

// =======================
//    TRẢ VỀ TRANG HTML
// =======================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "trang2.html"));
});

// =======================
//   WEBSOCKET SERVER (CHAT)
// =======================
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws, request) => {
  const userId = request.userId;
  const username = request.username;

  onlineUsers[userId] = username;

  broadcast({ type: "onlineList", users: onlineUsers });

  ws.on("message", msg => {
    const text = msg.toString();
    broadcast({ type: "chat", userId, username, text });
  });

  ws.on("close", () => {
    delete onlineUsers[userId];
    broadcast({ type: "onlineList", users: onlineUsers });
  });
});

// Hàm gửi cho mọi client
function broadcast(data) {
  const json = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(json);
  });
}

// =======================
//   SERVER LISTEN
// =======================
const server = app.listen(10001, () => {
  console.log("Server đang chạy cổng 10001");
});

// Kết nối WebSocket
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, "http://localhost");
  request.userId = url.searchParams.get("userId");
  request.username = url.searchParams.get("username");

  wss.handleUpgrade(request, socket, head, ws => {
    wss.emit("connection", ws, request);
  });
});
