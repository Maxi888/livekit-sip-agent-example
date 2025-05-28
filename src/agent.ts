import {
  type JobContext,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  multimodal,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import {RoomServiceClient} from 'livekit-server-sdk';
import {fileURLToPath} from 'url';

import { verifyEnv } from './env.js';


const {
  LIVEKIT_API_KEY = '',
  LIVEKIT_API_SECRET = '',
  LIVEKIT_URL = '',
  OPENAI_API_KEY = '',
  SIP_USERNAME = '',
  SIP_PASSWORD = '',
  SIP_TRUNK_URI = '',
} = verifyEnv([
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'LIVEKIT_URL',
  'OPENAI_API_KEY',
  'SIP_USERNAME',
  'SIP_PASSWORD',
  'SIP_TRUNK_URI',
], [
  'SIP_USERNAME',
  'SIP_PASSWORD',
  'SIP_TRUNK_URI',
]);

console.log(`Agent starting with LiveKit URL: ${LIVEKIT_URL}`);
console.log(`SIP credentials configured: Username=${SIP_USERNAME || 'NOT SET'}, Password=${SIP_PASSWORD ? 'SET' : 'NOT SET'}`);
console.log(`SIP trunk URI: ${SIP_TRUNK_URI || 'NOT SET'}`);

const roomServiceClient = new RoomServiceClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
);

export const agentDefinition = defineAgent({
  entry: async (ctx: JobContext) => {
    console.log('Agent entry point called, attempting to connect...');
    try {
      // Add logging for room information
      console.log(`Room name: ${ctx.room.name}`);
      console.log(`Room metadata: ${JSON.stringify(ctx.room.metadata)}`);
      
      // Listen for room events
      ctx.room.on('participantConnected', (participant) => {
        console.log(`New participant connected: ${participant.identity}`);
        console.log(`Participant metadata: ${JSON.stringify(participant.metadata)}`);
        console.log(`Participant details: ${JSON.stringify(participant)}`);
        
        // Log any available methods or properties
        try {
          console.log(`Participant properties: ${Object.keys(participant).join(', ')}`);
        } catch (err) {
          console.log(`Could not log participant properties: ${err}`);
        }
      });
      
      ctx.room.on('connectionStateChanged', (state) => {
        console.log(`Room connection state changed: ${state}`);
      });
      
      // Add special logging for any events happening in the room
      ctx.room.on('trackPublished', (publication: any, participant: any) => {
        console.log(`Track published: ${publication.trackName || publication.source || 'unknown'} by ${participant.identity}`);
        console.log(`Track publication info: ${JSON.stringify(publication)}`);
        console.log(`Publishing participant info: ${JSON.stringify(participant)}`);
      });
      
      // Connect to the room
      await ctx.connect();
      console.log('Successfully connected to LiveKit');
      console.log(`Room name: ${ctx.room.name}`);
      console.log('waiting for participant');
      
      const participant = await ctx.waitForParticipant();
      console.log(`starting basic phone agent for ${participant.identity}`);
      console.log(`Participant info: ${JSON.stringify({
        identity: participant.identity,
        sid: participant.sid,
        metadata: participant.metadata,
      })}`);

      const model = new openai.realtime.RealtimeModel({
        instructions: `You are a helpful assistant accessible by phone.
          You provide clear, concise answers to any questions the caller might have.
          Be friendly, professional, and helpful at all times.
          If the caller asks you to perform tasks you cannot do, politely explain your limitations.`,
        apiKey: OPENAI_API_KEY,
      });

      const fncCtx: llm.FunctionContext = {
        endCall: {
          description: 'End the call and delete the room',
          parameters: {},
          execute: async () => {
            console.log('Ending call, waiting for 5 seconds before deleting room...');

            // Schedule disconnection
            setTimeout(async () => {
              console.log('Deleting room...');
              await roomServiceClient.deleteRoom(ctx.room.name!);
            }, 5000);

            return 'Thank you for calling. Goodbye!';
          },
        },
      };

      const agent = new multimodal.MultimodalAgent({model, fncCtx});
      const session = await agent
        .start(ctx.room, participant)
        .then(session => session as openai.realtime.RealtimeSession);

      session.conversation.item.create(
        new llm.ChatMessage({
          role: llm.ChatRole.ASSISTANT,
          content:
            'Greet the caller warmly and ask how you can help them today.',
        }),
      );
      session.response.create();
    } catch (error) {
      console.error('Error in agent:', error);
    }
  },
});

// This is executed when the file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cli.runApp(new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'my-telephony-agent',
  }));
}

export default agentDefinition;
