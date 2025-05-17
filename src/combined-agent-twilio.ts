import express from 'express';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import twilio from 'twilio';
import { RoomServiceClient } from 'livekit-server-sdk';
import crypto from 'crypto';
import { verifyEnv } from './env.js';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get environment variables
const {
  LIVEKIT_API_KEY = '',
  LIVEKIT_API_SECRET = '',
  LIVEKIT_URL = '',
  TWILIO_ACCOUNT_SID = '',
  TWILIO_AUTH_TOKEN = '',
} = verifyEnv([
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'LIVEKIT_URL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
]);

// Port configuration - required for Heroku
const PORT = process.env.PORT || 3000;

// Create LiveKit client
const roomService = new RoomServiceClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
);

// Initialize Express app
const app = express();
const server = createServer(app);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Create Twilio response with VoiceResponse
const VoiceResponse = twilio.twiml.VoiceResponse;

// Root endpoint
app.get('/', (req, res) => {
  res.send('LiveKit Agent with Twilio Integration - ACTIVE');
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Main webhook for Twilio voice calls
app.post('/twilio-webhook', async (req, res) => {
  try {
    console.log('Received call from Twilio:', req.body);
    
    const from = req.body.From || 'unknown';
    const to = req.body.To || 'unknown';
    const callSid = req.body.CallSid;
    
    console.log(`Incoming call from ${from} to ${to} with SID ${callSid}`);
    
    // Create a unique room name for this call
    const roomName = `call-${crypto.randomBytes(8).toString('hex')}`;
    
    // Create a LiveKit room
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 300, // 5 minutes
      metadata: JSON.stringify({
        callerNumber: from,
        calledNumber: to,
        callSid: callSid,
        provider: 'twilio'
      })
    });
    
    console.log(`Created LiveKit room: ${roomName}`);
    
    // Generate a token for the caller
    const response = new VoiceResponse();
    
    // Connect call to the room using WebSockets with bidirectional audio
    // This will connect to our LiveKit agent
    const connect = response.connect();
    connect.stream({
      url: `${LIVEKIT_URL.replace('wss://', 'wss://')}/twilio?room=${roomName}&identity=caller`,
    });
    
    // Set response content type
    res.setHeader('Content-Type', 'text/xml');
    res.send(response.toString());
    
    console.log(`Connected caller to LiveKit room ${roomName}`);
    
  } catch (error) {
    console.error('Error handling Twilio webhook:', error);
    
    // Return a basic response to prevent call failure
    const response = new VoiceResponse();
    response.say('Sorry, an error occurred. Please try again later.');
    
    res.setHeader('Content-Type', 'text/xml');
    res.send(response.toString());
  }
});

// Status callback webhook
app.post('/twilio-status', (req, res) => {
  console.log('Call status update:', req.body);
  res.sendStatus(200);
});

// Start the web server
server.listen(PORT, () => {
  console.log(`Twilio webhook server listening on port ${PORT}`);
  
  // Start the LiveKit agent in a separate process
  const agentPath = path.join(__dirname, 'agent.ts');
  console.log(`Starting LiveKit agent from: ${agentPath}`);
  
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
  
  console.log('LiveKit agent started in separate process');
}); 