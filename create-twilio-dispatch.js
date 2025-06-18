import { SipClient } from 'livekit-server-sdk';

// LiveKit configuration
const LIVEKIT_URL = 'wss://vocieagentpipelinetest-1z3kctsj.livekit.cloud';
const LIVEKIT_API_KEY = 'APIT7AdAjtqf3oA';
const LIVEKIT_API_SECRET = 'tDOrcAXqa9ngwGiwhBe338fY7eaL6wTmPe63yfbgWAcF';

async function createTwilioDispatchRule() {
  try {
    const sipClient = new SipClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    
    console.log('🔍 Creating Twilio-only dispatch rule...');
    
    // Create dispatch rule using the correct API format (from SDK examples)
    const newRule = await sipClient.createSipDispatchRule(
      {
        // Rule configuration
        type: 'individual',
        roomPrefix: 'call-'
      },
      {
        // Request options
        name: 'Twilio Only Dispatch',
        trunkIds: ['ST_4Z3syPUw3LoL'], // Only Twilio trunk
        hidePhoneNumber: false,
        inboundNumbers: ['+498962828048'],
        attributes: {},
        roomConfig: {
          agents: [{
            agentName: 'my-telephony-agent'
          }]
        }
      }
    );
    
    console.log('✅ SUCCESS! Twilio dispatch rule created:');
    console.log(`  - Rule ID: ${newRule.sipDispatchRuleId}`);
    console.log(`  - Name: ${newRule.name}`);
    console.log(`  - Trunk ID: ST_4Z3syPUw3LoL (Twilio only)`);
    console.log(`  - Agent: my-telephony-agent`);
    console.log(`  - Room prefix: call-`);
    
    console.log('\n📞 TEST NOW:');
    console.log('  Call Twilio number: +49 89 62828048');
    console.log('  This should now work without interference from Jambonz headers');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createTwilioDispatchRule(); 