import express from 'express';
import { fileURLToPath } from 'url';
import * as agentModule from './agent.js';

const port = process.env.PORT || 3000;
const app = express();

app.get('/', (req, res) => {
  res.send('LiveKit SIP Agent is running');
});

app.get('/health', (req, res) => {
  res.send({ status: 'ok' });
});

// Start both the web server and the agent
app.listen(port, () => {
  console.log(`Web server listening on port ${port}`);
  
  // Start the agent
  const agent = agentModule.default;
  console.log('LiveKit SIP Agent started');
}); 