/*
*	Serveur multijoueur — Abidjan City
*	Installation : npm install ws
*	Démarrage : node server.js
*	Port : Railway ou 8080 en local
 */
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const PORT = Number(process.env.PORT) || 8080; const MAX_PLAYERS_PER_ROOM = 12; const MAX_MESSAGE_SIZE = 2048;
const rooms = new Map(); let nextId = 1;
// Serveur HTTP
const server = http.createServer((req, res) => {  if (req.url === '/health') {  res.writeHead(200, {'Content-Type': 'application/json'
});
res.end(JSON.stringify({  status: 'ok',
rooms: rooms.size
}));  return;
}
res.writeHead(200, {
'Content-Type': 'text/plain; charset=utf-8'
});
res.end('Abidjan City multiplayer server is running.');
});
// Serveur WebSocket 
const wss = new WebSocketServer
({
server, maxPayload: MAX_MESSAGE_SIZE });
function send(client, data) {
if (client.readyState === WebSocket.OPEN) {  client.send(JSON.stringify(data));
}
}
function broadcast(room, data, excludedClient = null) {  for (const client of room) {  if (client !== excludedClient) {  send(client, data);
}
}
}
wss.on('connection', (ws) => {
ws.id = nextId++;  ws.room = null;  ws.roomKey = null;  ws.name = 'Joueur';  ws.hero = 0;  ws.alive = true;
ws.on('pong', () => {  ws.alive = true;
});
ws.on('message', (raw) => {  let message;
try {
message = JSON.parse(raw.toString());
} catch {
send(ws, {
t: 'error',
text: 'Message JSON invalide.'
});
return;
}
if (
!message ||  typeof message !== 'object' ||
Array.isArray(message)
) {  return;
}
 // Entrée dans un salon  if (message.t === 'join' && !ws.room) 
{
const roomKey = String(  message.room || 'yop'  ).trim().slice(0, 12);
let room = rooms.get(roomKey);
if (!room) {  room = new Set();  rooms.set(roomKey, room);
}
if (room.size >= MAX_PLAYERS_PER_ROOM) {  send(ws, {
t: 'chat',
name: 'Serveur',
text: `Salon plein (${MAX_PLAYERS_PER_ROOM} joueurs maximum).`
});
return;
}
ws.name = String(  message.name || 'Joueur'
).trim().slice(0, 14) || 'Joueur';
ws.hero = Number.isFinite(Number(message.hero))
? Math.trunc(Number(message.hero))
: 0;
ws.roomKey = roomKey;
 // Liste des joueurs présents 
send(ws, {  t: 'welcome',  id: ws.id,
players: [...room].map((player) => ({  id: player.id,
name: player.name,  hero: player.hero
}))
});
room.add(ws);  ws.room = room;
 // Informer les autres joueurs
  broadcast(room, {
t: 'join',
id: ws.id,
name: ws.name,  hero: ws.hero
}, ws);
return;
}
 // Connexion obligatoire à un salon  if (!ws.room) return;
 // Synchronisation des joueurs et tirs
if (
message.t === 's' ||  message.t === 'shot'
) {
const outgoing = {  ...message,  id: ws.id
};
broadcast(ws.room, outgoing, ws);  } else if (message.t === 'hit') {
const targetId = Number(message.to);
const damage = Math.min(
120,
Math.max(0, Number(message.dmg) || 0)  );
for (const player of ws.room) {  if (player.id === targetId) {  send(player, {
t: 'hit',
from: ws.id,
dmg: damage
});
break;
}
}
} else if (message.t === 'died') {
broadcast(ws.room, {
t: 'killed',  id: ws.id,  by: Number(message.by) || 0
});
} else if (message.t === 'chat') {
broadcast(ws.room, {
t: 'chat',
name: ws.name,
text: String(  message.text || ''
).slice(0, 80)
});
}
});
 // Déconnexion
ws.on('close', () => {
if (!ws.room) return;
const room = ws.room;
room.delete(ws);
broadcast(room, {
t: 'leave',  id: ws.id
});
if (room.size === 0) {  rooms.delete(ws.roomKey);
}
ws.room = null;  ws.roomKey = null;
});
ws.on('error', (error) => {  console.error(
`Erreur WebSocket joueur ${ws.id}:`,  error.message
);
});
});
// Surveillance des connexions 
const heartbeat = setInterval(() => {
for (const client of wss.clients) {
if (!client.alive) {  client.terminate();  continue;
}
client.alive = false;  client.ping();
}
}, 15000);
wss.on('close', () => {  clearInterval(heartbeat);
});
// Démarrage du serveur
server.listen(PORT, '0.0.0.0', () => {
console.log(
`Abidjan City : serveur HTTP actif sur le port ${PORT}`
);
console.log(
`WebSocket : ws://localhost:${PORT} (en local)`
);
});
