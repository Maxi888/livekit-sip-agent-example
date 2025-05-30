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

async function setupOutboundTrunk() {
  console.log('Setting up outbound trunk for API-based calling...\n');
  
  try {
    // List existing outbound trunks
    console.log('Checking existing outbound trunks...');
    const trunks = await sipClient.listSipOutboundTrunk();
    console.log(`Found ${trunks.length} existing outbound trunks`);
    
    // Delete existing trunk if needed
    const existingTrunk = trunks.find(t => t.name === 'api-outbound-trunk');
    if (existingTrunk) {
      console.log(`Deleting existing trunk: ${existingTrunk.sipTrunkId}`);
      await sipClient.deleteSipTrunk({ sipTrunkId: existingTrunk.sipTrunkId });
    }
    
    // Create new outbound trunk for API-based calls
    console.log('\nCreating new outbound trunk...');
    const trunk = await sipClient.createSipOutboundTrunk({
      trunk: {
        name: 'api-outbound-trunk',
        // This is a dummy address since we're using the API approach
        // The actual routing happens via call_id in the SIP URI
        address: '5t4n6j0wnrl.sip.livekit.cloud',
        numbers: ['+4991874350352', '91874350352', '4991874350352'],
        transport: 'AUTO',
        // Headers for Schmidtkom compatibility
        headers: {
          'X-Carrier': 'schmidtkom',
          'X-LiveKit-Source': 'api-registration'
        }
      }
    });
    
    console.log('\n✅ Outbound trunk created successfully!');
    console.log(`Trunk ID: ${trunk.sipTrunkId}`);
    console.log(`Name: ${trunk.name}`);
    console.log(`Numbers: ${trunk.numbers.join(', ')}`);
    console.log('\n📝 This trunk will be used for API-based pre-registration calls');
    
    // Clean up old inbound trunks/dispatch rules (no longer needed)
    console.log('\n🧹 Cleaning up old inbound configuration...');
    
    const inboundTrunks = await sipClient.listSipInboundTrunk();
    for (const inTrunk of inboundTrunks) {
      console.log(`Deleting inbound trunk: ${inTrunk.name} (${inTrunk.sipTrunkId})`);
      await sipClient.deleteSipTrunk({ sipTrunkId: inTrunk.sipTrunkId });
    }
    
    const dispatchRules = await sipClient.listSipDispatchRule();
    for (const rule of dispatchRules) {
      console.log(`Deleting dispatch rule: ${rule.name} (${rule.sipDispatchRuleId})`);
      await sipClient.deleteSipDispatchRule({ sipDispatchRuleId: rule.sipDispatchRuleId });
    }
    
    console.log('\n✅ Cleanup complete!');
    console.log('\n🎯 Next Steps:');
    console.log('1. Update Jambonz to use the /livekit-api endpoint');
    console.log('2. Deploy the updated middleware');
    console.log('3. Test with the API-based approach');
    
  } catch (error) {
    console.error('Error setting up trunk:', error);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.details) {
      console.error('Error details:', error.details);
    }
  }
}

setupOutboundTrunk(); 