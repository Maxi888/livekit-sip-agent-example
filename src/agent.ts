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
import { weatherFunctionDefinition, executeWeatherFunction } from './realtime/weather-functions.js';


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
    console.log(`Job info: ${JSON.stringify({
      id: ctx.job.id,
      roomName: ctx.room.name,
      metadata: ctx.job.metadata,
      agentName: ctx.job.agentName,
    })}`);
    
    // Parse room metadata if it's a string
    const parsedMetadata = typeof ctx.room.metadata === 'string' ? 
      (() => { try { return JSON.parse(ctx.room.metadata); } catch { return {}; } })() : 
      ctx.room.metadata || {};
    
    // Check for API-based calls
    const isApiCall = ctx.room.name?.startsWith('call-') || 
                     parsedMetadata.source === 'api-registration';
    
    if (isApiCall) {
      console.log('📞 Detected API-based call');
      console.log(`Room metadata: ${JSON.stringify(parsedMetadata)}`);
    }
    
    try {
      // Add logging for room information
      console.log(`Room name: ${ctx.room.name}`);
      console.log(`Room metadata: ${JSON.stringify(ctx.room.metadata)}`);
      
      // Listen for room events
      ctx.room.on('participantConnected', (participant) => {
        console.log(`New participant connected: ${participant.identity}`);
        console.log(`Participant metadata: ${JSON.stringify(participant.metadata)}`);
        console.log(`Participant details: ${JSON.stringify(participant)}`);
        
        // Check if this is a SIP participant
        const isSipParticipant = participant.attributes?.['sip.phoneNumber'] || 
                                participant.attributes?.['sip.callID'] ||
                                participant.identity?.includes('sip_') ||
                                participant.identity?.includes('phone_') ||
                                participant.identity?.includes('+');
        
        if (isSipParticipant) {
          console.log('✅ SIP participant detected!');
          console.log(`SIP attributes: ${JSON.stringify(participant.attributes)}`);
          
          // Log API call specific details
          if (isApiCall) {
            console.log('📊 API Call Details:', {
              callerId: participant.attributes?.['sip.callerId'],
              toNumber: participant.attributes?.['sip.toNumber'],
              carrier: participant.attributes?.['carrier'],
            });
          }
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
      console.log(`starting telephony agent for ${participant.identity}`);
      console.log(`Participant info: ${JSON.stringify({
        identity: participant.identity,
        sid: participant.sid,
        metadata: participant.metadata,
      })}`);

      const model = new openai.realtime.RealtimeModel({
        instructions: `Du bist ein hilfreicher Assistent, der telefonisch erreichbar ist.
          Du antwortest auf Deutsch und gibst klare, präzise Antworten auf alle Fragen des Anrufers.
          Sei freundlich, professionell und hilfsbereit.
          Falls der Anrufer dich bittet, Aufgaben zu erledigen, die du nicht ausführen kannst, erkläre höflich deine Grenzen.
          Du kannst auch Wetterinformationen bereitstellen, wenn danach gefragt wird.`,
        apiKey: OPENAI_API_KEY,
        modalities: ['text', 'audio'],
        voice: 'alloy', // You can change to 'nova' for a different German voice
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

            return 'Vielen Dank für Ihren Anruf. Auf Wiederhören!';
          },
        },
        get_weather: {
          description: weatherFunctionDefinition.description,
          parameters: weatherFunctionDefinition.parameters,
          execute: async (args: { location: string }) => {
            console.log(`🌤️ Weather function called for: ${args.location}`);
            return await executeWeatherFunction(args);
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
            'Begrüße den Anrufer herzlich auf Deutsch und frage, wie du ihm heute helfen kannst.',
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
  // Run the agent with explicit dispatch for telephony
  cli.runApp(new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'my-telephony-agent',
    // Ensure we're running in development mode for better logging
    logLevel: 'debug',
    // Don't specify host/port - let the framework handle it
  }));
}

export default agentDefinition;
