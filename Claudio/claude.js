const Anthropic = require('@anthropic-ai/sdk');
const { buildContext } = require('./context');

const client = new Anthropic();

async function askClaudio(userMessage = '') {
  const { system, userMessage: msg } = buildContext(userMessage);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system,
    messages: [{ role: 'user', content: msg }],
  });

  const raw = response.content[0].text.trim();

  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error('Claudio returned no valid JSON');

  return JSON.parse(jsonMatch[1]);
}

module.exports = { askClaudio };
