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

// Import our new weather service - this is safe and doesn't affect existing functionality
import { weatherService, WeatherService } from './mcp/weather-service.js';

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
  OPENAI_API_KEY = '',
} = verifyEnv([
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'LIVEKIT_URL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'OPENAI_API_KEY',
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

// Store active conversations with state
interface Conversation {
  messages: {role: string, content: string}[];
  callSid: string;
  from: string;
  to: string;
  roomName: string;
  turnCount: number;
  createdAt: number;
}

// Keep track of active conversations
const activeConversations = new Map<string, Conversation>();

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
    
    // Add a voice prompt and gather input for the first turn
    response.say({
      voice: 'Polly.Marlene',
      language: 'de-DE'
    }, 'Hallo, vielen Dank für Ihren Anruf. Ich bin ein KI-Assistent. Wie kann ich Ihnen heute helfen?');
    
    // Create a gather with input type speech
    const gather = response.gather({
      input: ['speech'],
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      action: `https://livekit-sip-agent-eu-68ef5104b68b.herokuapp.com/gather-result?room=${roomName}`,
      method: 'POST',
      language: 'de-DE'
    });
    
    // Add a backup say command in case the gather times out
    response.say({
      voice: 'Polly.Marlene',
      language: 'de-DE'
    }, 'Ich habe nichts gehört. Bitte versuchen Sie es später erneut.');
    response.hangup();
    
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
  response.say({
    voice: 'Polly.Marlene',
    language: 'de-DE'
  }, 'Dies ist ein Test des Twilio-Antwortsystems.');
  
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

// Add an endpoint to handle gather results and implement the conversation loop
app.post('/gather-result', async (req, res) => {
  console.log('Received gather result:', req.body);
  
  const roomName = req.query.room as string;
  const speechResult = req.body.SpeechResult;
  const callSid = req.body.CallSid;
  const from = req.body.From;
  const to = req.body.To;
  
  console.log(`Speech recognized in room ${roomName}: "${speechResult}"`);
  
  // Initialize or retrieve conversation state
  let conversation: Conversation;
  if (!activeConversations.has(callSid)) {
    conversation = {
      messages: [
        { role: 'system', content: 'Du bist ein hilfreicher Assistent, der telefonisch erreichbar ist. Halte deine Antworten prägnant und gesprächig, da sie dem Anrufer vorgesprochen werden. Denke daran, dass dies ein Telefongespräch ist. Du kannst auch Wetterinformationen für jeden Ort bereitstellen, wenn danach gefragt wird. Antworte immer auf Deutsch.' },
      ],
      callSid,
      from,
      to,
      roomName,
      turnCount: 0,
      createdAt: Date.now()
    };
    activeConversations.set(callSid, conversation);
  } else {
    conversation = activeConversations.get(callSid)!;
  }
  
  // Add user message to conversation
  conversation.messages.push({ role: 'user', content: speechResult });
  conversation.turnCount++;
  
  // Process with OpenAI API - now with weather enhancement
  try {
    let assistantResponse: string;
    
    // Check if this is a weather query - this is the key integration point
    // We detect weather queries and handle them specially, but don't break existing functionality
    if (WeatherService.isWeatherQuery(speechResult)) {
      console.log('🌤️ Weather query detected, processing...');
      
      // Extract location from user input
      const location = WeatherService.extractLocation(speechResult);
      
      if (location) {
        console.log(`Weather location extracted: ${location}`);
        
        try {
          // Get weather data with our robust service
          const weatherResponse = await weatherService.getWeather(location);
          
          // Format for speech and add to conversation context
          const weatherSpeech = weatherService.formatForSpeech(weatherResponse);
          
          // Add weather context to conversation for AI processing
          conversation.messages.push({ 
            role: 'system', 
            content: `Weather information for ${location}: ${JSON.stringify(weatherResponse.data)}. Provide this information naturally in conversation.` 
          });
          
          // Use the weather speech directly for faster response
          assistantResponse = weatherSpeech;
          
          console.log(`Weather response generated: ${assistantResponse}`);
          
        } catch (weatherError) {
          console.error('Weather service failed, falling back to AI:', weatherError);
          
          // If weather service fails, fall back to normal AI processing
          // This ensures the conversation continues even if weather fails
          assistantResponse = await processWithAI(conversation.messages);
        }
      } else {
        // Weather query detected but no location found - ask for clarification
        assistantResponse = "Gerne helfe ich Ihnen mit dem Wetter. Könnten Sie mir bitte sagen, für welche Stadt oder welchen Ort Sie sich interessieren?";
        console.log('Weather query without location, asking for clarification');
      }
    } else {
      // Not a weather query, process normally with AI
      // This preserves all existing functionality
      assistantResponse = await processWithAI(conversation.messages);
    }
    
    // Add assistant response to conversation history
    conversation.messages.push({ role: 'assistant', content: assistantResponse });
    
    console.log(`AI response: "${assistantResponse}"`);
    
    // Create Twilio response
    const response = new VoiceResponse();
    
    // Exit conversation after too many turns or if user says goodbye
    const isGoodbye = speechResult.toLowerCase().includes('goodbye') || 
                       speechResult.toLowerCase().includes('bye') ||
                       speechResult.toLowerCase().includes('thank you') ||
                       speechResult.toLowerCase().includes('auf wiedersehen') ||
                       speechResult.toLowerCase().includes('wiedersehen') ||
                       speechResult.toLowerCase().includes('tschüss') ||
                       speechResult.toLowerCase().includes('danke') ||
                       speechResult.toLowerCase().includes('vielen dank');
    
    if (conversation.turnCount >= 10 || isGoodbye) {
      // End the conversation
      response.say({
        voice: 'Polly.Marlene',
        language: 'de-DE'
      }, assistantResponse);
      response.say({
        voice: 'Polly.Marlene',
        language: 'de-DE'
      }, 'Vielen Dank für Ihren Anruf. Auf Wiederhören!');
      response.hangup();
      
      // Cleanup the conversation
      activeConversations.delete(callSid);
    } else {
      // Continue the conversation
      response.say({
        voice: 'Polly.Marlene',
        language: 'de-DE'
      }, assistantResponse);
      
      // Create a new gather for the next user input
      const gather = response.gather({
        input: ['speech'],
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        action: `https://livekit-sip-agent-eu-68ef5104b68b.herokuapp.com/gather-result?room=${roomName}`,
        method: 'POST',
        language: 'de-DE'
      });
      
      // Add a timeout fallback
      response.say({
        voice: 'Polly.Marlene',
        language: 'de-DE'
      }, 'Ich habe nichts gehört. Vielen Dank für Ihren Anruf. Auf Wiederhören!');
      response.hangup();
    }
    
    // Send TwiML response
    res.setHeader('Content-Type', 'text/xml');
    res.send(response.toString());
    
  } catch (error) {
    console.error('Error processing conversational response:', error);
    
    // Handle failure gracefully
    const response = new VoiceResponse();
    response.say({
      voice: 'Polly.Marlene',
      language: 'de-DE'
    }, 'Entschuldigung, es ist ein Problem bei der Verarbeitung Ihrer Anfrage aufgetreten. Bitte versuchen Sie es später erneut.');
    response.hangup();
    
    res.setHeader('Content-Type', 'text/xml');
    res.send(response.toString());
  }
});

/**
 * Helper function to process messages with OpenAI AI
 * Extracted to separate weather logic from AI processing
 * This keeps the existing AI processing unchanged
 */
async function processWithAI(messages: {role: string, content: string}[]): Promise<string> {
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 200,
      temperature: 0.7
    })
  });
  
  if (!openaiResponse.ok) {
    throw new Error(`OpenAI API responded with status: ${openaiResponse.status}`);
  }
  
  const openaiData = await openaiResponse.json() as {
    choices: [{
      message: {
        content: string;
      };
    }];
  };
  
  return openaiData.choices[0]?.message?.content || "Entschuldigung, ich konnte diese Anfrage nicht bearbeiten.";
}

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