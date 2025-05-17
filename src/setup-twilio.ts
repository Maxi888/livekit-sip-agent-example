import twilio from 'twilio';
import {verifyEnv} from './env.js';

// NOTE: you are expected to define the following environment variables in `.env.local`:
const {
  TWILIO_ACCOUNT_SID = '',
  TWILIO_AUTH_TOKEN = '',
  TWILIO_PHONE_NUMBER = '',
  AGENT_WEBHOOK_URL = '', // The URL of your Heroku app
} = verifyEnv([
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'AGENT_WEBHOOK_URL',
]);

// Twilio Setup
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

console.log('Setting up Twilio Direct Agent Integration');

// Step 1: Configure the phone number to use Voice webhooks
const incomingPhoneNumbers = await twilioClient.incomingPhoneNumbers.list();
const incomingPhoneNumber = incomingPhoneNumbers.find(
  i => i.phoneNumber === TWILIO_PHONE_NUMBER,
);

if (!incomingPhoneNumber) {
  throw new Error(`No phone number matching ${TWILIO_PHONE_NUMBER} found`);
}

// Update the phone number to use webhooks
console.log(`Configuring phone number ${TWILIO_PHONE_NUMBER} for direct agent integration`);
await twilioClient.incomingPhoneNumbers(incomingPhoneNumber.sid).update({
  voiceUrl: `${AGENT_WEBHOOK_URL}/twilio-webhook`,
  voiceMethod: 'POST',
  statusCallback: `${AGENT_WEBHOOK_URL}/twilio-status`,
  statusCallbackMethod: 'POST'
});

console.log(`
---
Twilio phone number ${TWILIO_PHONE_NUMBER} has been configured to connect directly to your agent.

Next steps:
1. Create a twilio-webhook.js file in your Heroku app to handle incoming calls
2. Add a TwiML endpoint to connect calls to your agent using WebSockets
3. Update your agent to handle incoming WebSocket connections from Twilio

Voice webhook URL: ${AGENT_WEBHOOK_URL}/twilio-webhook
Status callback URL: ${AGENT_WEBHOOK_URL}/twilio-status
---
`);
