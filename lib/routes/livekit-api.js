const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');

// Extract hostname for SIP domain
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://vocieagentpipelinetest-1z3kctsj.livekit.cloud';
const livekitHost = LIVEKIT_URL.replace('wss://', '').replace('ws://', '');
const sipDomain = livekitHost.replace('.livekit.cloud', '.sip.livekit.cloud');

// Store call info for reference
const activeCalls = new Map();

router.post('/', async (req, res) => {
  const {logger, requestId = uuidv4()} = req.app.locals;
  logger.info({requestId}, 'Incoming LiveKit call request');
  
  const {
    from,
    to,
    call_sid: callSid,
    account_sid: accountSid,
  } = req.body;

  try {
    // Generate unique room name
    const roomName = `call-${uuidv4()}`;
    
    logger.info({
      requestId,
      from,
      to,
      roomName,
      callSid
    }, 'Creating LiveKit call');

    // Store call info
    activeCalls.set(callSid, {
      roomName,
      from,
      to
    });

    // Return dial to LiveKit with room name in the URI
    // This simpler approach just dials to a room and lets LiveKit handle agent dispatch
    const sipUri = `sip:${roomName}@${sipDomain}`;
    
    logger.info({requestId, sipUri}, 'Returning LiveKit SIP URI for dial');

    res.json([
      {
        type: 'dial',
        target: [
          {
            type: 'sip',
            sipUri: sipUri,
            auth: {
              username: process.env.LIVEKIT_SIP_USERNAME || 'livekit_client',
              password: process.env.LIVEKIT_SIP_PASSWORD || 'syzhod-2xasMe-wumrag'
            }
          }
        ],
        answerOnBridge: true,
        referHook: '/livekit-api/refer',
        actionHook: '/livekit-api/action',
        headers: {
          'X-LiveKit-Room': roomName,
          'X-From-Number': from,
          'X-To-Number': to
        }
      }
    ]);

  } catch (error) {
    logger.error({
      requestId,
      error: error.message,
      stack: error.stack
    }, 'Error handling LiveKit call');

    res.status(500).json({
      error: 'Failed to create LiveKit call',
      message: error.message
    });
  }
});

// Handle call action (answer/hangup)
router.post('/action', async (req, res) => {
  const {logger} = req.app.locals;
  const {sip_status, call_sid} = req.body;
  
  logger.info({
    callSid: call_sid,
    sipStatus: sip_status
  }, 'LiveKit call action');

  // Clean up stored call info
  if (sip_status >= 400) {
    activeCalls.delete(call_sid);
  }

  res.sendStatus(200);
});

// Handle REFER (transfer)
router.post('/refer', async (req, res) => {
  const {logger} = req.app.locals;
  const {refer_to, call_sid} = req.body;
  
  logger.info({
    callSid: call_sid,
    referTo: refer_to
  }, 'LiveKit REFER request');

  // For now, we'll just accept the transfer
  res.sendStatus(202);
});

// Get active calls (for debugging)
router.get('/calls', (req, res) => {
  const calls = Array.from(activeCalls.entries()).map(([sid, info]) => ({
    callSid: sid,
    ...info
  }));
  
  res.json({
    count: calls.length,
    calls
  });
});

module.exports = router; 