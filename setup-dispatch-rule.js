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

async function setupDispatchRule() {
  console.log('Setting up SIP dispatch rule for telephony agent...\n');
  
  try {
    // List existing dispatch rules
    console.log('Checking existing dispatch rules...');
    const rules = await sipClient.listSipDispatchRule();
    console.log(`Found ${rules.length} existing dispatch rules`);
    
    // Find and delete any rule with our specific name
    const ruleName = 'telephony-agent-dispatch';
    const existingRule = rules.find(r => r.name === ruleName);
    
    if (existingRule) {
      console.log(`Deleting existing rule: ${ruleName}`);
      await sipClient.deleteSipDispatchRule(existingRule.sipDispatchRuleId);
    }
    
    // Find the correct trunk ID
    const trunks = await sipClient.listSipInboundTrunk();
    console.log(`\nFound ${trunks.length} inbound trunks:`);
    
    let targetTrunk = null;
    for (const trunk of trunks) {
      console.log(`- ${trunk.name} (ID: ${trunk.sipTrunkId})`);
      // Check if this trunk has our phone number
      if (trunk.numbers && trunk.numbers.some(num => 
        num.includes('91874350352') || num.includes('4991874350352')
      )) {
        targetTrunk = trunk;
        console.log(`  ✓ This trunk has our phone number!`);
      }
    }
    
    if (!targetTrunk) {
      console.error('ERROR: No trunk found with the phone number 91874350352');
      return;
    }
    
    console.log(`\nUsing trunk: ${targetTrunk.name} (${targetTrunk.sipTrunkId})`);
    
    // Create the dispatch rule with explicit agent dispatch
    console.log('\nCreating new dispatch rule with telephony agent...');
    const newRule = await sipClient.createSipDispatchRule(
      {
        // Use individual dispatch to create a new room for each call
        type: 'individual',
        roomPrefix: 'sip-call-',
        // IMPORTANT: Specify the agent to dispatch
        roomConfig: {
          agents: [{
            agentName: 'my-telephony-agent'
          }]
        }
      },
      {
        name: ruleName,
        trunkIds: [targetTrunk.sipTrunkId],
      },
    );
    
    console.log(`\n✅ Dispatch rule created successfully!`);
    console.log(`Rule ID: ${newRule.sipDispatchRuleId}`);
    console.log(`\nConfiguration summary:`);
    console.log(`- Trunk: ${targetTrunk.name}`);
    console.log(`- Phone number: ${targetTrunk.numbers.join(', ')}`);
    console.log(`- Room prefix: sip-call-`);
    console.log(`- Agent: my-telephony-agent`);
    console.log(`\nYour telephony agent will now be dispatched to handle incoming calls!`);
    
  } catch (error) {
    console.error('Error setting up dispatch rule:', error);
  }
}

// Run the setup
setupDispatchRule(); 