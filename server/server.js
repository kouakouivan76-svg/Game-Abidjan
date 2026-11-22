/* Serveur multijoueur Abidjan City — Node.js + ws.  Lancer :  npm install && npm start  (port 8080, variable PORT) */
const { WebSocketServer } = require('ws');
const port = process.env.PORT || 8080, wss = new WebSocketServer({ port });
const rooms = new Map(); let nextId = 1;
const send = (c, o) => { if (c.readyState === 1) c.send(JSON.stringify(o)); };
const others = (c, f) => { if (c.room) for (const o of c.room) if (o !== c) f(o); };
wss.on('connection', ws => {
  ws.id = nextId++; ws.room = null; ws.alive = true; ws.on('pong', () => ws.alive = true);
  ws.on('message', raw => {
    if (raw.length > 2048) return; let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'join' && !ws.room) {
      const key = String(m.room || 'yop').slice(0, 12); if (!rooms.has(key)) rooms.set(key, new Set()); const room = rooms.get(key);
      if (room.size >= 12) { send(ws, { t: 'chat', name: 'Serveur', text: 'Salon plein (12 max)' }); return; }
      ws.name = String(m.name || 'Joueur').slice(0, 14); ws.hero = m.hero | 0; ws.roomKey = key;
      send(ws, { t: 'welcome', id: ws.id, players: [...room].map(o => ({ id: o.id, name: o.name, hero: o.hero })) }); others({ room }, o => send(o, { t: 'join', id: ws.id, name: ws.name, hero: ws.hero }));
      room.add(ws); ws.room = room; return;
    }
    if (!ws.room) return;
    if (m.t === 's') { m.id = ws.id; others(ws, o => send(o, m)); }
    else if (m.t === 'shot') { m.id = ws.id; others(ws, o => send(o, m)); }
    else if (m.t === 'hit') { const dmg = Math.min(120, Math.max(0, +m.dmg || 0)); for (const o of ws.room) if (o.id === m.to) send(o, { t: 'hit', from: ws.id, dmg }); }
    else if (m.t === 'died') { const msg = { t: 'killed', id: ws.id, by: m.by | 0 }; for (const o of ws.room) send(o, msg); }
    else if (m.t === 'chat') { const msg = { t: 'chat', name: ws.name, text: String(m.text || '').slice(0, 80) }; for (const o of ws.room) send(o, msg); }
  });
  ws.on('close', () => { if (ws.room) { ws.room.delete(ws); others({ room: ws.room }, o => send(o, { t: 'leave', id: ws.id })); if (!ws.room.size) rooms.delete(ws.roomKey); } });
});
setInterval(() => { for (const c of wss.clients) { if (!c.alive) { c.terminate(); continue; } c.alive = false; c.ping(); } }, 15000);
console.log('Abidjan City multijoueur : ws://localhost:' + port);
