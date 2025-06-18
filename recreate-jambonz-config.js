import { SipClient } from 'livekit-server-sdk';

// LiveKit configuration
const LIVEKIT_URL = 'wss://vocieagentpipelinetest-1z3kctsj.livekit.cloud';
const LIVEKIT_API_KEY = 'APIT7AdAjtqf3oA';
const LIVEKIT_API_SECRET = 'tDOrcAXqa9ngwGiwhBe338fY7eaL6wTmPe63yfbgWAcF';

async function recreateJambonzConfig() {
  try {
    const sipClient = new SipClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    
    console.log('🔧 Recreating Jambonz SIP trunk and dispatch rule...');
    
    // 1. Create Jambonz SIP trunk
    console.log('\n1️⃣ Creating Jambonz SIP trunk...');
    const jambonzTrunk = await sipClient.createSipInboundTrunk({
      name: 'Jambonz SIP Trunk',
      numbers: ['+4991874350352'],
      // Allow Jambonz IP addresses
      allowedAddresses: [
        '172.20.11.236/32',
        '89.184.187.124/32', 
        '54.236.168.131/32'
      ],
      // SIP authentication for Jambonz
      authUsername: 'jambonz_user',
      authPassword: 'jambonz_secure_password_2024',
      metadata: 'Jambonz trunk for LiveKit agent integration'
    });
    
    console.log('✅ Jambonz trunk created:', jambonzTrunk.sipTrunkId);
    
    // 2. Create dispatch rule for Jambonz trunk
    console.log('\n2️⃣ Creating Jambonz dispatch rule...');
    const dispatchRule = await sipClient.createSipDispatchRule({
      type: 'individual',
      roomPrefix: 'call-'
    }, {
      name: 'Jambonz Agent Dispatch',
      trunkIds: [jambonzTrunk.sipTrunkId],
      metadata: 'Dispatch rule for Jambonz calls to my-telephony-agent',
      attributes: {
        agent_name: 'my-telephony-agent'
      }
    });
    
    console.log('✅ Dispatch rule created:', dispatchRule.sipDispatchRuleId);
    
    console.log('\n🎉 Jambonz configuration recreated successfully!');
    console.log('\nConfiguration:');
    console.log('- Trunk ID:', jambonzTrunk.sipTrunkId);
    console.log('- Trunk Number: +4991874350352'); 
    console.log('- Dispatch Rule ID:', dispatchRule.sipDispatchRuleId);
    console.log('- Agent: my-telephony-agent');
    console.log('- Room Pattern: call-{caller}_{random}');
    
  } catch (err) {
    console.error('❌ Error recreating Jambonz configuration:', err.message);
    process.exit(1);
  }
}

recreateJambonzConfig(); 