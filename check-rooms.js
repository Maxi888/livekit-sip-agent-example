import { RoomServiceClient } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = 'APIT7AdAjtqf3oA';
const LIVEKIT_API_SECRET = 'tDOrcAXqa9ngwGiwhBe338fY7eaL6wTmPe63yfbgWAcF';
const LIVEKIT_URL = 'wss://vocieagentpipelinetest-1z3kctsj.livekit.cloud';

const roomService = new RoomServiceClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
);

console.log('Checking LiveKit rooms...\n');

try {
  const rooms = await roomService.listRooms();
  console.log(`Found ${rooms.length} rooms:\n`);
  
  rooms.forEach(room => {
    console.log(`Room: ${room.name}`);
    console.log(`  Created: ${new Date(room.creationTime * 1000).toLocaleString()}`);
    console.log(`  Participants: ${room.numParticipants}`);
    console.log(`  Metadata: ${room.metadata || 'none'}`);
    console.log('---');
  });
  
  // Check for recent call rooms
  const recentCallRooms = rooms.filter(room => room.name.startsWith('call-'));
  console.log(`\nFound ${recentCallRooms.length} call rooms`);
  
} catch (error) {
  console.error('Error listing rooms:', error);
} 