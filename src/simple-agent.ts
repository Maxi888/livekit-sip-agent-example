import {
  JobContext,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
} from '@livekit/agents';
import {RoomServiceClient} from 'livekit-server-sdk';
import {fileURLToPath} from 'url';

// Use environment variables instead of hardcoded values
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const LIVEKIT_URL = process.env.LIVEKIT_URL || '';

console.log(`LiveKit configuration: URL=${LIVEKIT_URL}`);

// Create a room service client
const roomServiceClient = new RoomServiceClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
);

const agent = defineAgent({
  entry: async (ctx: JobContext) => {
    console.log('Simple agent started, attempting to connect...');
    
    try {
      // Connect to the room
      await ctx.connect();
      console.log('Agent connected to room successfully');
      
      // Log room information
      console.log(`Room name: ${ctx.room.name}`);
      
      // Add detailed event handlers
      ctx.room.on('trackPublished', (publication: any, participant: any) => {
        console.log(`TRACK PUBLISHED by ${participant.identity}`);
        console.log(`Track kind: ${publication.kind || 'unknown'}`);
        console.log(`Track name: ${publication.trackName || 'unnamed'}`);
        console.log(`Track source: ${publication.source || 'unknown'}`);
        console.log(`Track enabled: ${publication.enabled !== undefined ? publication.enabled : 'unknown'}`);
        
        // Try to subscribe to the track
        try {
          if (typeof publication.setSubscribed === 'function') {
            publication.setSubscribed(true);
          }
        } catch (err) {
          console.log(`Could not subscribe to track: ${err}`);
        }
      });
      
      ctx.room.on('trackSubscribed', (track: any, publication: any, participant: any) => {
        console.log(`TRACK SUBSCRIBED from ${participant.identity}`);
        console.log(`Track kind: ${track.kind || 'unknown'}`);
        console.log(`Track muted: ${track.muted !== undefined ? track.muted : 'unknown'}`);
        
        if (track.kind === 'audio') {
          console.log(`AUDIO TRACK DETECTED - SIP AUDIO IS WORKING!`);
          // If this logs, we know SIP audio is arriving to the agent
        }
      });
      
      // Wait for a participant to join
      console.log('Waiting for caller to join...');
      const participant = await ctx.waitForParticipant();
      console.log(`Caller joined: ${participant.identity}`);
      
      // Log participant details safely
      console.log(`Participant metadata: ${JSON.stringify(participant.metadata || {})}`);
      
      // Create a simple conversation agent - just log that we've connected
      console.log('CALLER HAS CONNECTED SUCCESSFULLY!');
      console.log('SIP CALL IS WORKING PROPERLY!');
      
      // Keep the agent running to receive tracks
      console.log('Keeping agent alive for 60 seconds to receive audio...');
      
      // Keep the process running for 60 seconds
      return new Promise((resolve) => {
        setTimeout(() => {
          console.log('Test complete, closing agent');
          resolve();
        }, 60000);
      });
    } catch (error) {
      console.error('Error in agent:', error);
    }
  },
});

// Start the agent
console.log('Starting simple LiveKit agent...');
cli.runApp(new WorkerOptions({agent: fileURLToPath(import.meta.url)})); 