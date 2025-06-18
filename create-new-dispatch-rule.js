import { SipClient } from 'livekit-server-sdk';

// LiveKit configuration
const LIVEKIT_URL = 'wss://vocieagentpipelinetest-1z3kctsj.livekit.cloud';
const LIVEKIT_API_KEY = 'APIT7AdAjtqf3oA';
const LIVEKIT_API_SECRET = 'tDOrcAXqa9ngwGiwhBe338fY7eaL6wTmPe63yfbgWAcF';

async function createNewDispatchRule() {
  try {
    const sipClient = new SipClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    
    console.log('🔍 Getting current configuration...');
    
    // Get current trunks
    const [inboundTrunks] = await Promise.all([
      sipClient.listSipInboundTrunk(),
    ]);
    
    console.log('\n📋 Current Inbound Trunks:');
    inboundTrunks.forEach(trunk => {
      console.log(`  - ${trunk.sipTrunkId}: ${trunk.name} (${trunk.numbers?.join(', ')})`);
    });
    
    // Collect all inbound trunk IDs 
    const allTrunkIds = inboundTrunks.map(t => t.sipTrunkId);
    
    console.log(`\n🔧 Creating new dispatch rule with trunk IDs: [${allTrunkIds.join(', ')}]`);
    
    // Create new dispatch rule with correct configuration
    const createRequest = {
      trunk_ids: allTrunkIds, // Use snake_case for API
      name: 'Fixed Dispatch Rule',
      metadata: 'Updated to include all trunk IDs',
      rule: {
        dispatchRuleIndividual: {
          roomPrefix: 'call-'
        }
      },
      room_config: {
        agents: [{
          agentName: 'my-telephony-agent',
          metadata: ''
        }]
      },
      hide_phone_number: false,
      inbound_numbers: [],
      attributes: {},
      room_preset: '',
      krisp_enabled: false,
      media_encryption: 'SIP_MEDIA_ENCRYPT_DISABLE'
    };
    
    console.log('\n⚡ Creating new dispatch rule...');
    const newRule = await sipClient.createSipDispatchRule(createRequest);
    
    console.log('✅ SUCCESS! New dispatch rule created:');
    console.log(`  - Rule ID: ${newRule.sipDispatchRuleId}`);
    console.log(`  - Name: ${newRule.name}`);
    console.log(`  - Trunk IDs: [${newRule.trunkIds?.join(', ')}]`);
    console.log(`  - Agent: ${newRule.roomConfig?.agents?.[0]?.agentName}`);
    
    console.log('\n🎉 FIXED! Both Twilio and Jambonz calls should now be dispatched to the agent.');
    console.log('\n📞 TEST NOW:');
    console.log('  1. Call Twilio number: +49 89 62828048 (should still work)');
    console.log('  2. Call Jambonz number: +49 9187 4350352 (should now work!)');
    
    console.log('\n💡 NOTE: You now have 2 dispatch rules. You may want to delete the old empty one later.');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createNewDispatchRule(); 