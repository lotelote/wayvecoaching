const https = require('https');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: {'Content-Type':'application/json'}, body: JSON.stringify({error:'Method not allowed'}) };
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: {'Content-Type':'application/json'}, body: JSON.stringify({error:'Clé API non configurée sur le serveur'}) };
  }

  let system, messages;
  try {
    const body = JSON.parse(event.body);
    system = body.system;
    messages = body.messages;
  } catch(e) {
    return { statusCode: 400, headers: {'Content-Type':'application/json'}, body: JSON.stringify({error:'Body invalide'}) };
  }

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1200,
    system: system,
    messages: messages
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            resolve({ statusCode: 400, headers: {'Content-Type':'application/json'}, body: JSON.stringify({error: parsed.error.message}) });
          } else {
            const reply = (parsed.content || []).map(b => b.text || '').join('');
            resolve({ statusCode: 200, headers: {'Content-Type':'application/json'}, body: JSON.stringify({reply}) });
          }
        } catch(e) {
          resolve({ statusCode: 500, headers: {'Content-Type':'application/json'}, body: JSON.stringify({error: 'Parse error: ' + data.slice(0,200)}) });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, headers: {'Content-Type':'application/json'}, body: JSON.stringify({error: e.message}) });
    });

    req.write(payload);
    req.end();
  });
};
