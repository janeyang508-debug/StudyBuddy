const audio = document.getElementById('audio');
const sayText = document.getElementById('say-text');
const songTitle = document.getElementById('song-title');
const songArtist = document.getElementById('song-artist');
const queueEl = document.getElementById('queue');
const statusEl = document.getElementById('status');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');

let queue = [];
let currentIndex = 0;

const ws = new WebSocket(`ws://${location.host}`);
ws.onmessage = e => {
  const data = JSON.parse(e.data);
  if (data.type === 'now-playing') loadNowPlaying(data);
};

function loadNowPlaying(data) {
  if (data.say) sayText.textContent = `"${data.say}"`;
  queue = data.songs || [];
  currentIndex = 0;
  renderQueue();
  playTrack(0);
}

function playTrack(index) {
  if (!queue[index]) return;
  const track = queue[index];
  currentIndex = index;
  audio.src = track.url;
  audio.play().catch(() => {});
  songTitle.textContent = track.title;
  songArtist.textContent = track.artist;
  statusEl.textContent = 'playing';
  highlightQueue();
}

function renderQueue() {
  queueEl.innerHTML = '';
  queue.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'queue-item';
    div.textContent = `${t.artist} — ${t.title}`;
    div.onclick = () => playTrack(i);
    queueEl.appendChild(div);
  });
}

function highlightQueue() {
  [...queueEl.children].forEach((el, i) => {
    el.style.color = i === currentIndex ? '#c9a96e' : '';
  });
}

audio.addEventListener('ended', () => {
  if (currentIndex + 1 < queue.length) {
    playTrack(currentIndex + 1);
  } else {
    statusEl.textContent = 'idle';
  }
});

async function sendMessage() {
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  sendBtn.disabled = true;
  statusEl.textContent = 'thinking…';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });
    if (!res.ok) throw new Error(await res.text());
  } catch (err) {
    sayText.textContent = `Error: ${err.message}`;
    statusEl.textContent = 'error';
  } finally {
    sendBtn.disabled = false;
  }
}

sendBtn.onclick = sendMessage;
input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
