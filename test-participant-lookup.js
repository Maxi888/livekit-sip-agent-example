import { SipClient, RoomServiceClient } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = 'APIT7AdAjtqf3oA';
const LIVEKIT_API_SECRET = 'tDOrcAXqa9ngwGiwhBe338fY7eaL6wTmPe63yfbgWAcF';
const LIVEKIT_URL = 'wss://vocieagentpipelinetest-1z3kctsj.livekit.cloud';

const sipClient = new SipClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

async function testParticipantLookup() {
  console.log('Testing participant lookup...\n');
  
  try {
    // Get active calls from middleware
    const response = await fetch('https://jambonz-livekit-middleware-fd9b45a06ae5.herokuapp.com/livekit-api/calls');
    const data = await response.json();
    
    if (data.calls.length === 0) {
      console.log('No active calls found');
      return;
    }
    
    // Take the most recent call
    const recentCall = data.calls[data.calls.length - 1];
    console.log('Most recent call:');
    console.log(`- Room: ${recentCall.roomName}`);
    console.log(`- SIP Call ID: ${recentCall.sipCallId}`);
    console.log(`- Created: ${recentCall.createdAt}`);
    console.log(`- From: ${recentCall.from} -> To: ${recentCall.to}`);
    
    // Check if the room exists
    console.log('\nChecking if room exists...');
    try {
      const rooms = await roomService.listRooms([recentCall.roomName]);
      if (rooms.length > 0) {
        console.log('✅ Room exists!');
        const room = rooms[0];
        console.log(`- Participants: ${room.numParticipants}`);
        console.log(`- Created: ${new Date(room.creationTime * 1000).toLocaleString()}`);
        
        // List participants in the room
        if (room.numParticipants > 0) {
          const participants = await roomService.listParticipants(recentCall.roomName);
          console.log('\nParticipants in room:');
          participants.forEach(p => {
            console.log(`- ${p.identity} (${p.sid})`);
          });
        } else {
          console.log('❌ Room is empty - no participants joined');
        }
      } else {
        console.log('❌ Room does not exist or has expired');
      }
    } catch (roomError) {
      console.log('❌ Error checking room:', roomError.message);
    }
    
    // Try to list all SIP participants (if such API exists)
    console.log('\n\nChecking SIP participant registration...');
    console.log('Note: There is no direct API to query pre-registered SIP participants');
    console.log('The participant only exists in LiveKit\'s internal state until they join');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testParticipantLookup(); 