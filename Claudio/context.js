const fs = require('fs');
const path = require('path');
const db = require('./state');

function readFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch { return ''; }
}

function buildContext(userMessage = '') {
  const persona   = readFile(path.join(__dirname, 'prompts/dj-persona.md'));
  const taste     = readFile(path.join(__dirname, 'user/taste.md'));
  const routines  = readFile(path.join(__dirname, 'user/routines.md'));
  const moodRules = readFile(path.join(__dirname, 'user/mood-rules.md'));

  const now = new Date();
  const timeStr = now.toLocaleString('en-US', { weekday: 'long', hour: '2-digit', minute: '2-digit' });

  const recentPlays = db.getRecentPlays(5)
    .map(p => `- ${p.artist} - ${p.title}`)
    .join('\n') || 'None yet';

  const systemPrompt = `${persona}\n\n---\n## Current Context\n\n**Time:** ${timeStr}\n\n**Listener's Taste:**\n${taste}\n\n**Routines:**\n${routines}\n\n**Mood Rules:**\n${moodRules}\n\n**Recent Plays (do not repeat):**\n${recentPlays}\n`;

  return {
    system: systemPrompt,
    userMessage: userMessage || 'What should I listen to right now?',
  };
}

module.exports = { buildContext };
