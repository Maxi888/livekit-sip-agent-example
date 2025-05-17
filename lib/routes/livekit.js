const assert = require('assert');
const {registerLiveKitCall, getE164, validateCountryCode} = require('../utils');
const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY || false;
const OVERRIDE_FROM_USER = process.env.OVERRIDE_FROM_USER | false;
// Make SPECIFIC_PHONE_NUMBER optional - if set, will filter by this number, otherwise accept all calls
const SPECIFIC_PHONE_NUMBER = process.env.SPECIFIC_PHONE_NUMBER || null;

// Require LiveKit URL environment variable
assert.ok(process.env.LIVEKIT_SIP_URI, 
  'LIVEKIT_SIP_URI env variable is required');

// IF a default country code has been set check its the right format,
if (DEFAULT_COUNTRY){
  validateCountryCode(DEFAULT_COUNTRY);
}

// Add German phone number formatting function
const formatGermanPhoneNumber = (phoneNumber) => {
  // Remove any non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // If number doesn't start with country code, add it
  if (!cleaned.startsWith('49')) {
    cleaned = '49' + cleaned;
  }
  
  // Ensure it starts with +
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
};

const service = ({logger, makeService}) => {
  const svc = makeService({path: '/livekit'});

  svc.on('session:new', async(session) => {
    session.locals = {logger: logger.child({call_sid: session.call_sid})};
    let {from, to, direction, call_sid} = session;
    
    // Format the 'to' number for German numbers
    const formattedTo = formatGermanPhoneNumber(to);
    
    logger.info({session, formattedTo}, `new incoming call: ${session.call_sid}`);

    /* Send ping to keep alive websocket as some platforms timeout, 25sec as 30sec timeout is not uncommon */
    session.locals.keepAlive = setInterval(() => {
      session.ws.ping();
    }, 25000);

    let outboundFromLiveKit = false;
    if (session.direction === 'inbound' &&
      process.env.PSTN_TRUNK_NAME && process.env.LIVEKIT_SIP_CLIENT_USERNAME &&
      session.sip.headers['X-Authenticated-User']) {

      /* check if the call is coming from LiveKit; i.e. using the sip credential we provisioned there */
      const username = session.sip.headers['X-Authenticated-User'].split('@')[0];
      if (username === process.env.LIVEKIT_SIP_CLIENT_USERNAME) {
        logger.info(`call ${session.call_sid} is coming from LiveKit`);
        outboundFromLiveKit = true;
      }
    }
    
    session
      .on('/refer', onRefer.bind(null, session))
      .on('close', onClose.bind(null, session))
      .on('error', onError.bind(null, session))
      .on('/dialAction', onDialAction.bind(null, session));

    try {
      let target;
      let headers = {}
      
      // Only filter by specific phone number if configured
      if (SPECIFIC_PHONE_NUMBER && to !== SPECIFIC_PHONE_NUMBER && to !== SPECIFIC_PHONE_NUMBER.replace('+', '')) {
        logger.info(`Rejecting call to ${to} - not our specific number ${SPECIFIC_PHONE_NUMBER}`);
        session
          .sip_decline({status: 404})
          .reply();
        return;
      }

      if (outboundFromLiveKit) {
        /* call is coming from LiveKit, so we will forward it to the original dialed number */
        target = [
          {
            type: 'phone',
            number: formattedTo,
            trunk: process.env.PSTN_TRUNK_NAME
          }
        ];
        /* Workaround for SIPGATE, put User ID as from and CLI in header */
        if (OVERRIDE_FROM_USER) {
          from = OVERRIDE_FROM_USER;
        }
      }
      else {
        /* Call is from the PSTN, forward to the LiveKit SIP URI */
        const dest = DEFAULT_COUNTRY ? await getE164(formattedTo, DEFAULT_COUNTRY) : formattedTo;
        const { livekit_call_id, livekit_sip_uri } = await registerLiveKitCall(logger, {
          from,
          to: dest,
          direction,
          call_sid,
          dynamic_variables: {
            user_name: 'Caller',
            user_phone: from
          }
        });

        logger.info({livekit_call_id, livekit_sip_uri}, 'Call registered with LiveKit');
        
        // Extract domain part from the SIP URI
        const sipUriParts = livekit_sip_uri.split('@');
        const sipDomain = sipUriParts.length > 1 ? sipUriParts[1] : livekit_sip_uri.replace('sip:', '');
        
        target = [
          {
            type: 'sip',
            sipUri: `sip:${livekit_call_id}@${sipDomain}`
          }
        ];
      }

      session
        .dial({
          callerId: from,
          answerOnBridge: true,
          anchorMedia: true,
          referHook: '/refer',
          actionHook: '/dialAction',
          target,
          headers
        })
        .hangup()
        .send();
    } catch (err) {
      session.locals.logger.info({err}, `Error to responding to incoming call: ${session.call_sid}`);
      session.close();
    }
  });
};

const onRefer = (session, evt) => {
  const {logger} = session.locals;
  const {refer_details} = evt;
  logger.info({refer_details}, `session ${session.call_sid} received refer`);

  session
    .sip_refer({
      referTo: refer_details.refer_to_user,
      referredBy: evt.to
    })
    .reply();
};

const onClose = (session, code, reason) => {
  const {logger} = session.locals;
  clearInterval(session.locals.keepAlive); // remove keep alive
  logger.info({session, code, reason}, `session ${session.call_sid} closed`);
};

const onError = (session, err) => {
  const {logger} = session.locals;
  logger.info({err}, `session ${session.call_sid} received error`);
};

const onDialAction = (session, evt) => {
  const {logger} = session.locals;
  if (evt.dial_call_status != 'completed') {
    logger.info(`outbound dial failed with ${evt.dial_call_status}, ${evt.dial_sip_status}`);
    session
      .sip_decline({status: evt.dial_sip_status})
      .reply();
  }
}

module.exports = service; 