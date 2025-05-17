import {
  JobContext,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
} from '@livekit/agents';
import {RoomServiceClient} from 'livekit-server-sdk';
import {fileURLToPath} from 'url';

// Direct configuration values - hard-coding for the test script
const LIVEKIT_API_KEY = 'APIT7AdAjtqf3oA';
const LIVEKIT_API_SECRET = 'tDOrcAXqa9ngwGiwhBe338fY7eaL6wTmPe63yfbgWAcF';
const LIVEKIT_URL = 'wss://vocieagentpipelinetest-1z3kctsj.livekit.cloud';

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
      
      // Wait for a participant to join
      console.log('Waiting for caller to join...');
      const participant = await ctx.waitForParticipant();
      console.log(`Caller joined: ${participant.identity}`);
      
      // Create a simple conversation agent - just log that we've connected
      console.log('CALLER HAS CONNECTED SUCCESSFULLY!');
      console.log('SIP CALL IS WORKING PROPERLY!');
      
      // Schedule room deletion
      console.log('Scheduling room deletion in 20 seconds...');
      setTimeout(async () => {
        console.log('Deleting room...');
        try {
          await roomServiceClient.deleteRoom(ctx.room.name!);
          console.log('Room deleted successfully');
        } catch (error) {
          console.error('Error deleting room:', error);
        }
      }, 20000);
      
      console.log('Agent processing complete');
      
      // Keep the process running for 30 seconds
      return new Promise((resolve) => {
        setTimeout(resolve, 30000);
      });
    } catch (error) {
      console.error('Error in agent:', error);
    }
  },
});

// Start the agent
console.log('Starting simple LiveKit agent...');
cli.runApp(new WorkerOptions({agent: fileURLToPath(import.meta.url)})); 