import { SipClient, RoomServiceClient } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = 'APIT7AdAjtqf3oA';
const LIVEKIT_API_SECRET = 'tDOrcAXqa9ngwGiwhBe338fY7eaL6wTmPe63yfbgWAcF';
const LIVEKIT_URL = 'wss://vocieagentpipelinetest-1z3kctsj.livekit.cloud';

const sipClient = new SipClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

async function testCreateParticipant() {
  console.log('Testing createSipParticipant...\n');
  
  try {
    // Get trunk
    const trunks = await sipClient.listSipOutboundTrunk();
    const trunk = trunks.find(t => t.name === 'api-outbound-trunk') || trunks[0];
    
    if (!trunk) {
      console.error('No trunk found!');
      return;
    }
    
    console.log('Using trunk:', trunk.name, 'at', trunk.address);
    
    const roomName = `test-room-${Date.now()}`;
    console.log('\nCreating participant in room:', roomName);
    
    // Create participant
    const participant = await sipClient.createSipParticipant(
      trunk.sipTrunkId,
      '+4991874350352',
      roomName,
      {
        participantIdentity: 'test-caller',
        participantName: 'Test Caller',
        participantMetadata: JSON.stringify({ test: true }),
        autoSubscribe: true,
        agents: ['my-telephony-agent']
      }
    );
    
    console.log('\nParticipant created:');
    console.log('- Participant ID:', participant.participantId);
    console.log('- SIP Call ID:', participant.sipCallId);
    console.log('- Full response:', JSON.stringify(participant, null, 2));
    
    // Check if room was created
    console.log('\nChecking if room was created...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const rooms = await roomService.listRooms();
    const createdRoom = rooms.find(r => r.name === roomName);
    
    if (createdRoom) {
      console.log('✅ Room was created!');
      console.log('- Room name:', createdRoom.name);
      console.log('- Participants:', createdRoom.numParticipants);
      console.log('- Metadata:', createdRoom.metadata);
    } else {
      console.log('❌ Room was NOT created!');
      console.log('Available rooms:', rooms.map(r => r.name));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

testCreateParticipant(); 