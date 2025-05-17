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
} = verifyEnv([
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'LIVEKIT_URL',
  'OPENAI_API_KEY',
]);

console.log(`Agent starting with LiveKit URL: ${LIVEKIT_URL}`);

const roomServiceClient = new RoomServiceClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
);

export const agentDefinition = defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    console.log('waiting for participant');
    const participant = await ctx.waitForParticipant();
    console.log(`starting basic phone agent for ${participant.identity}`);

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
  },
});

// This is executed when the file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cli.runApp(new WorkerOptions({agent: fileURLToPath(import.meta.url)}));
}

export default agentDefinition;
