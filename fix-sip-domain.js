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

async function fixSipDomain() {
  console.log('🔧 Fixing SIP Domain Configuration\n');
  
  try {
    // List existing outbound trunks
    console.log('Checking existing outbound trunks...');
    const trunks = await sipClient.listSipOutboundTrunk();
    
    // Find the api-outbound-trunk
    const apiTrunk = trunks.find(t => t.name === 'api-outbound-trunk');
    
    if (!apiTrunk) {
      console.error('❌ No api-outbound-trunk found!');
      console.log('Run setup-outbound-trunk.js first');
      return;
    }
    
    console.log('\nCurrent trunk configuration:');
    console.log(`- Name: ${apiTrunk.name}`);
    console.log(`- ID: ${apiTrunk.sipTrunkId}`);
    console.log(`- Current Address: ${apiTrunk.address}`);
    
    // Check if it's using the wrong domain
    if (apiTrunk.address === '5t4n6j0wnrl.sip.livekit.cloud') {
      console.log('\n⚠️  Trunk is using Retell\'s domain! This needs to be fixed.');
      
      // Delete the incorrect trunk
      console.log('\nDeleting incorrect trunk...');
      await sipClient.deleteSipTrunk(apiTrunk.sipTrunkId);
      
      // Create new trunk with correct domain
      console.log('Creating new trunk with correct domain...');
      const newTrunk = await sipClient.createSipOutboundTrunk(
        'api-outbound-trunk',  // name as first parameter
        'vocieagentpipelinetest-1z3kctsj.sip.livekit.cloud',  // address as second parameter
        ['+4991874350352', '91874350352', '4991874350352']  // numbers as third parameter
      );
      
      console.log('\n✅ Fixed! New trunk created with correct domain:');
      console.log(`- ID: ${newTrunk.sipTrunkId}`);
      console.log(`- Address: ${newTrunk.address}`);
      
    } else if (apiTrunk.address === 'vocieagentpipelinetest-1z3kctsj.sip.livekit.cloud') {
      console.log('\n✅ Trunk is already using the correct domain!');
    } else {
      console.log(`\n⚠️  Trunk is using an unexpected domain: ${apiTrunk.address}`);
      console.log('Please verify this is correct for your setup.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the fix
fixSipDomain(); 