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
const trunkName = 'inbound-trunk';
const trunks = await sipClient.listSipInboundTrunk();
let trunk = trunks.find(t => t.name === trunkName);

// Delete existing trunk if it exists
if (trunk) {
  console.log('Deleting existing LiveKit SIP inbound trunk');
  await sipClient.deleteSipTrunk(trunk.sipTrunkId);
  trunk = null;
}

console.log('Creating LiveKit SIP inbound trunk');
trunk = await sipClient.createSipInboundTrunk(
  trunkName,
  [SPECIFIC_PHONE_NUMBER], // Only accept calls for this specific number
  {
    auth_username: SIP_USERNAME,
    auth_password: SIP_PASSWORD,
  },
);

// Create a dispatch rule
const dispatchRuleName = 'inbound-dispatch-rule';
const dispatchRules = await sipClient.listSipDispatchRule();
let dispatchRule = dispatchRules.find(r => r.name === dispatchRuleName);

// Delete existing dispatch rule if it exists
if (dispatchRule) {
  console.log('Deleting existing LiveKit SIP dispatch rule');
  await sipClient.deleteSipDispatchRule(dispatchRule.sipDispatchRuleId);
  dispatchRule = null;
}

console.log('Creating LiveKit SIP dispatch rule');
dispatchRule = await sipClient.createSipDispatchRule(
  {
    type: 'individual',
    roomPrefix: 'call',
  },
  {
    name: dispatchRuleName,
    trunkIds: [trunk.sipTrunkId],
  },
);

console.log(`
---
Setup completed for your custom SIP trunk with LiveKit.
Configuration set to only answer calls to: ${SPECIFIC_PHONE_NUMBER}

Make sure your \`.env.local\` file has all the required environment variables, including your OpenAI API key.

Now you can run the command \`npm run agent\` and receive calls to ${SPECIFIC_PHONE_NUMBER} through your Schmidtkom SIP trunk.
---
`);
