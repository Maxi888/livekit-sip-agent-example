import { SipClient } from 'livekit-server-sdk';

// Configuration
const LIVEKIT_API_KEY = 'APIT7AdAjtqf3oA';
const LIVEKIT_API_SECRET = 'tDOrcAXqa9ngwGiwhBe338fY7eaL6wTmPe63yfbgWAcF';
const LIVEKIT_URL = 'wss://vocieagentpipelinetest-1z3kctsj.livekit.cloud';

const sipClient = new SipClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
);

async function setupDispatchRuleWithCodec() {
  console.log('Setting up SIP dispatch rule with codec configuration...\n');
  
  try {
    // List existing dispatch rules
    console.log('Checking existing dispatch rules...');
    const rules = await sipClient.listSipDispatchRule();
    console.log(`Found ${rules.length} existing dispatch rules`);
    
    // Find and delete any existing rule for our agent
    for (const rule of rules) {
      if (rule.metadata?.agentName === 'my-telephony-agent' || 
          rule.name === 'telephony-agent-dispatch-codec') {
        console.log(`Deleting existing rule: ${rule.sipDispatchRuleId}`);
        await sipClient.deleteSipDispatchRule(rule.sipDispatchRuleId);
      }
    }
    
    // Create new dispatch rule with codec preferences
    console.log('\nCreating new dispatch rule with codec support...');
    const dispatchRule = await sipClient.createSipDispatchRule(
      {
        // Use individual dispatch with room prefix
        type: 'individual',
        roomPrefix: 'call-',
        // IMPORTANT: Specify the agent and codec configuration
        roomConfig: {
          agents: [{
            agentName: 'my-telephony-agent'
          }],
          metadata: JSON.stringify({
            carrier: 'schmidtkom',
            codecs: ['PCMU', 'PCMA', 'telephone-event']
          })
        }
      },
      {
        name: 'telephony-agent-dispatch-codec',
        metadata: JSON.stringify({ 
          agentName: 'my-telephony-agent',
          carrier: 'schmidtkom',
          codecPreference: 'PCMU'
        }),
      }
    );
    
    console.log('\n✅ Dispatch rule created successfully!');
    console.log('Rule ID:', dispatchRule.sipDispatchRuleId);
    console.log('Rule details:', JSON.stringify(dispatchRule, null, 2));
    
    // Verify the rule
    console.log('\nVerifying dispatch rules...');
    const updatedRules = await sipClient.listSipDispatchRule();
    const newRule = updatedRules.find(r => r.sipDispatchRuleId === dispatchRule.sipDispatchRuleId);
    
    if (newRule) {
      console.log('✅ Rule verified successfully');
      console.log('- Room prefix:', 'call-');
      console.log('- Agent name:', 'my-telephony-agent');
      console.log('- Codec preference:', 'PCMU');
    }
    
  } catch (error) {
    console.error('❌ Error setting up dispatch rule:', error);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the setup
setupDispatchRuleWithCodec(); 