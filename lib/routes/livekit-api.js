const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { SipClient } = require('livekit-server-sdk');
const { RoomServiceClient } = require('livekit-server-sdk');

// Initialize LiveKit SIP client
// ... existing code ...

    }, 'Successfully created SIP participant');

    // Create the room with metadata to trigger agent dispatch
    const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    
    try {
      // Create or update room with metadata
      await roomService.createRoom({
        name: roomName,
        metadata: JSON.stringify({
          sipCallId: participant.sipCallId,
          participantId: participant.participantId,
          fromNumber: from,
          toNumber: formattedTo,
          carrier: 'schmidtkom',
          source: 'api-registration',
          agentRequested: 'my-telephony-agent'
        })
      });
      
      logger.info({
        requestId,
        roomName
      }, 'Created/updated room with metadata');
    } catch (roomError) {
      logger.warn({
        requestId,
        error: roomError.message
      }, 'Failed to create/update room, it might already exist');
    }

    // Store call info
    activeCalls.set(callSid, {
// ... existing code ...
} 