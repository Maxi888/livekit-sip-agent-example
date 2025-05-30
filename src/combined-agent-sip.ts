import express from 'express';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Start a simple Express web server to keep Heroku happy
const app = express();

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'LiveKit SIP Agent',
    agent: 'my-telephony-agent',
    mode: 'telephony',
    timestamp: new Date().toISOString() 
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    mode: 'sip',
    integration: 'schmidtkom-jambonz-livekit'
  });
});

// Add a test endpoint to verify SIP configuration
app.get('/sip-config', (req, res) => {
  const config = {
    livekit_url: process.env.LIVEKIT_URL || 'NOT SET',
    livekit_api_key: process.env.LIVEKIT_API_KEY ? 'SET' : 'NOT SET',
    livekit_api_secret: process.env.LIVEKIT_API_SECRET ? 'SET' : 'NOT SET',
    openai_api_key: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET',
    sip_username: process.env.SIP_USERNAME || 'NOT SET',
    sip_password: process.env.SIP_PASSWORD ? 'SET' : 'NOT SET',
    sip_trunk_uri: process.env.SIP_TRUNK_URI || 'NOT SET',
    livekit_sip_uri: process.env.LIVEKIT_SIP_URI || 'NOT SET'
  };
  
  res.json(config);
});

// WebSocket handler (if needed for Heroku)
app.get('/ws', (req, res) => {
  res.json({ 
    message: 'WebSocket endpoint - agent handles connections directly',
    agent: 'my-telephony-agent'
  });
});

// Start the web server
app.listen(PORT, () => {
  console.log(`Web server is running on port ${PORT}`);
  console.log('Configuration:');
  console.log(`- LiveKit URL: ${process.env.LIVEKIT_URL || 'NOT SET'}`);
  console.log(`- SIP Username: ${process.env.SIP_USERNAME || 'NOT SET'}`);
  console.log(`- SIP Trunk URI: ${process.env.SIP_TRUNK_URI || 'NOT SET'}`);
  console.log(`- LiveKit SIP URI: ${process.env.LIVEKIT_SIP_URI || 'NOT SET'}`);
  
  // Start the LiveKit agent in a separate process
  const agentPath = path.join(__dirname, 'agent.ts');
  console.log(`Starting LiveKit SIP agent from: ${agentPath}`);
  
  // Use 'dev' mode for proper telephony support
  const agentProcess = exec(`npx tsx ${agentPath} dev`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Agent process error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Agent process stderr: ${stderr}`);
    }
    console.log(`Agent process stdout: ${stdout}`);
  });
  
  agentProcess.stdout?.on('data', (data) => {
    console.log(`Agent: ${data.toString().trim()}`);
  });
  
  agentProcess.stderr?.on('data', (data) => {
    console.error(`Agent error: ${data.toString().trim()}`);
  });
  
  agentProcess.on('close', (code) => {
    console.log(`Agent process exited with code ${code}`);
  });
  
  console.log('LiveKit SIP telephony agent started in dev mode');
  console.log('Agent name: my-telephony-agent');
  console.log('Ready to receive calls through Schmidtkom → Jambonz → LiveKit SIP pipeline');
}); 