import express from 'express';
import { createServer } from 'http';
import twilio from 'twilio';
import { RoomServiceClient } from 'livekit-server-sdk';
import crypto from 'crypto';
import { verifyEnv } from './env.js';

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

// Port configuration
const PORT = process.env.PORT || 3000;

// Create clients
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
  res.send('Twilio Webhook Server for LiveKit Agent');
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
      url: `wss://twilio-media-streams.livekit.cloud/twilio/${roomName}?apiKey=${LIVEKIT_API_KEY}&apiSecret=${LIVEKIT_API_SECRET}&identity=caller`,
      track: "both_tracks"
    });
    
    // Set response content type
    res.setHeader('Content-Type', 'text/xml');
    res.send(response.toString());
    
    console.log(`Connected caller to LiveKit room ${roomName}`);
    
    // Trigger the agent to join the room (this would happen automatically through LiveKit agents)
    // No need to do anything here as the agent should automatically join when a participant connects
    
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

// Start the server
server.listen(PORT, () => {
  console.log(`Twilio webhook server listening on port ${PORT}`);
});

export default app; 