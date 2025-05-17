import express from 'express';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import twilio from 'twilio';
import { RoomServiceClient } from 'livekit-server-sdk';
import crypto from 'crypto';
import { verifyEnv } from './env.js';
import WebSocket from 'ws';
import { WebSocketServer } from 'ws';

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

// Keep track of active calls and rooms
const activeRooms = new Map();

// Initialize Express app
const app = express();
const server = createServer(app);

// Create a WebSocket server for handling Twilio media streams
const wss = new WebSocketServer({ 
  server,
  path: '/media-stream'
});

console.log('WebSocket server created and listening on path: /media-stream');

// Handle WebSocket connections from Twilio
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established from:', req.headers['user-agent']);
  console.log('Connection headers:', req.headers);
  
  // Parse URL to get room name
  const urlParams = new URLSearchParams((req.url || '').split('?')[1] || '');
  const roomName = urlParams.get('room');
  
  if (!roomName) {
    console.error('WebSocket connection missing room parameter');
    ws.close();
    return;
  }
  
  console.log(`WebSocket connected for room: ${roomName}`);
  
  // Store the connection
  if (!activeRooms.has(roomName)) {
    activeRooms.set(roomName, { ws });
    console.log(`Created new active room record for ${roomName}`);
  } else {
    activeRooms.get(roomName).ws = ws;
    console.log(`Updated existing room record for ${roomName}`);
  }
  
  // Handle messages from Twilio
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Log media stream events for debugging
      if (data.event === 'start') {
        console.log('Media stream started:', JSON.stringify(data));
      } else if (data.event === 'media') {
        // Process media - in this case, just log receipt
        if (!data.media || !data.media.track) {
          return;
        }
        
        const { track } = data.media;
        
        // Log first couple of media packets then stop to reduce spam
        if (track === 'inbound' && activeRooms.get(roomName).logCount === undefined) {
          activeRooms.get(roomName).logCount = 0;
          console.log('First inbound audio received from Twilio');
        } else if (track === 'inbound' && activeRooms.get(roomName).logCount < 3) {
          activeRooms.get(roomName).logCount++;
          console.log(`Received inbound audio packet #${activeRooms.get(roomName).logCount}`);
        }
      } else if (data.event === 'stop') {
        console.log('Media stream stopped:', JSON.stringify(data));
        ws.close();
      } else {
        console.log(`Unknown event type: ${data.event}`);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      console.log('Raw message content:', message.toString().substring(0, 100) + '...');
    }
  });
  
  // Send a ping to keep the connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      console.log(`Sending ping to keep WebSocket alive for room ${roomName}`);
      ws.ping();
    }
  }, 30000);
  
  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for room ${roomName}:`, error);
  });
  
  // Handle WebSocket close
  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed for room: ${roomName}, code: ${code}, reason: ${reason || 'none'}`);
    clearInterval(pingInterval);
    activeRooms.delete(roomName);
  });
  
  // Send initial message to confirm connection
  ws.send(JSON.stringify({
    event: 'connected',
    room: roomName,
    timestamp: Date.now()
  }));
});

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
    
    // Add a voice prompt to indicate the call was received
    response.say('Call connected. Please wait while we connect you to an agent.');
    
    // Connect call to the room using WebSockets with bidirectional audio
    // Use Twilio's <Stream> verb properly
    const connect = response.connect();
    connect.stream({
      url: `wss://livekit-sip-agent-eu-68ef5104b68b.herokuapp.com/media-stream?room=${roomName}`,
      track: "both_tracks"
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

// Add a simple endpoint for testing TwiML responses
app.get('/test-twiml', (req, res) => {
  const response = new VoiceResponse();
  response.say('This is a test of the Twilio response system.');
  
  res.setHeader('Content-Type', 'text/xml');
  res.send(response.toString());
});

// Add a simple WebSocket test endpoint
app.get('/test-ws', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>WebSocket Test</title>
    </head>
    <body>
      <h1>WebSocket Test</h1>
      <div id="status">Connecting...</div>
      <script>
        const ws = new WebSocket('wss://' + window.location.host + '/media-stream?room=test-room');
        ws.onopen = () => {
          document.getElementById('status').textContent = 'Connected!';
        };
        ws.onclose = () => {
          document.getElementById('status').textContent = 'Disconnected';
        };
        ws.onerror = (error) => {
          document.getElementById('status').textContent = 'Error: ' + error;
        };
        ws.onmessage = (event) => {
          document.getElementById('status').textContent = 'Received: ' + event.data;
        };
      </script>
    </body>
    </html>
  `);
});

// Start the web server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  
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