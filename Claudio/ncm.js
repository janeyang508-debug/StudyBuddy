const NCM_BASE = process.env.NCM_BASE || 'http://localhost:3000';

async function searchSong(query) {
  const url = `${NCM_BASE}/search?keywords=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url);
  const data = await res.json();
  const songs = data?.result?.songs;
  if (!songs?.length) return null;
  const song = songs[0];
  return { id: song.id, title: song.name, artist: song.artists[0]?.name };
}

async function getSongUrl(id) {
  const res = await fetch(`${NCM_BASE}/song/url?id=${id}`);
  const data = await res.json();
  return data?.data?.[0]?.url || null;
}

async function resolveSongs(songList) {
  const results = [];
  for (const query of songList) {
    const found = await searchSong(query);
    if (!found) continue;
    const url = await getSongUrl(found.id);
    if (url) results.push({ ...found, url, query });
  }
  return results;
}

module.exports = { searchSong, getSongUrl, resolveSongs };
