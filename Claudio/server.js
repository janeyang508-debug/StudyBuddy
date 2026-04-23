require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { askClaudio } = require('./claude');
const { resolveSongs } = require('./ncm');
const db = require('./state');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let nowPlaying = null;

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

app.get('/api/now', (_, res) => res.json(nowPlaying || { state: 'idle' }));

app.get('/api/taste', (_, res) => {
  res.sendFile(path.join(__dirname, 'user/taste.md'));
});

app.get('/api/plan/today', async (_, res) => {
  try {
    const plan = await askClaudio('Give me a brief plan for what kind of music would suit today.');
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  try {
    const djResponse = await askClaudio(message);
    const resolved   = await resolveSongs(djResponse.songs || []);

    resolved.forEach(s => db.logPlay({ artist: s.artist, title: s.title, ncm_id: String(s.id) }));

    nowPlaying = { say: djResponse.say, songs: resolved, reason: djResponse.reason };
    broadcast({ type: 'now-playing', ...nowPlaying });

    res.json(nowPlaying);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

wss.on('connection', ws => {
  if (nowPlaying) ws.send(JSON.stringify({ type: 'now-playing', ...nowPlaying }));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Claudio running at http://localhost:${PORT}`));
