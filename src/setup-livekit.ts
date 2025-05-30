import {SipClient} from 'livekit-server-sdk';
import {verifyEnv} from './env.js';

const {
  LIVEKIT_API_KEY = '',
  LIVEKIT_API_SECRET = '',
  LIVEKIT_URL = '',
  SIP_TRUNK_URI = '',
  SIP_USERNAME = '',
  SIP_PASSWORD = '',
} = verifyEnv([
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'LIVEKIT_URL',
  'SIP_TRUNK_URI',
  'SIP_USERNAME',
  'SIP_PASSWORD',
]);

// The specific phone number you want to use with this LiveKit agent
const SPECIFIC_PHONE_NUMBER = '+4991874350352';

const sipClient = new SipClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
);

console.log('Setting up LiveKit SIP inbound trunk and dispatch rule');

// Inbound trunk setup
const trunkName = 'jambonz-inbound-persistent';  // Changed name to avoid conflicts
const trunks = await sipClient.listSipInboundTrunk();
let trunk = trunks.find(t => t.name === trunkName);

// REMOVED: Delete existing trunk logic - we want to keep existing trunks!
if (trunk) {
  console.log('Trunk already exists, skipping creation');
} else {
console.log('Creating LiveKit SIP inbound trunk');
  
  // Create trunk WITHOUT authentication to match middleware
trunk = await sipClient.createSipInboundTrunk(
  trunkName,
    ['4991874350352'],  // Without + prefix to match Jambonz format
  {
      // Only allow calls from Jambonz IP
      allowed_addresses: ['54.236.168.131'],
      // NO auth_username or auth_password - we don't want authentication
  },
);
  
  console.log(`Created trunk: ${trunk.sipTrunkId}`);
}

// Create a dispatch rule
const dispatchRuleName = 'jambonz-dispatch-persistent';  // Changed name
const dispatchRules = await sipClient.listSipDispatchRule();
let dispatchRule = dispatchRules.find(r => r.name === dispatchRuleName);

// REMOVED: Delete existing dispatch rule logic
if (dispatchRule) {
  console.log('Dispatch rule already exists, skipping creation');
} else {
console.log('Creating LiveKit SIP dispatch rule');
dispatchRule = await sipClient.createSipDispatchRule(
  {
    type: 'individual',
      roomPrefix: 'call-',  // Changed to match our previous configuration
  },
  {
    name: dispatchRuleName,
    trunkIds: [trunk.sipTrunkId],
  },
);
  
  console.log(`Created dispatch rule: ${dispatchRule.sipDispatchRuleId}`);
}

console.log(`
---
Setup completed for your custom SIP trunk with LiveKit.
Configuration:
- Trunk accepts calls from Jambonz IP: 54.236.168.131
- Trunk accepts calls TO number: 4991874350352 (without + prefix)
- No authentication required
- Calls routed to rooms with prefix: call-

This trunk will NOT be deleted on subsequent runs.
---
`);
