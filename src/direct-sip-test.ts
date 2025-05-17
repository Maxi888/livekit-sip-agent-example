import {SipClient} from 'livekit-server-sdk';

// Direct configuration values - hard-coding for the test script
const LIVEKIT_API_KEY = 'APIT7AdAjtqf3oA';
const LIVEKIT_API_SECRET = 'tDOrcAXqa9ngwGiwhBe338fY7eaL6wTmPe63yfbgWAcF';
const LIVEKIT_URL = 'wss://vocieagentpipelinetest-1z3kctsj.livekit.cloud';
const SIP_USERNAME = 'livekit_client';
const SIP_PASSWORD = 'syzhod-2xasMe-wumrag';
const SPECIFIC_PHONE_NUMBER = '+4991874350352';

// Create a SIP client with the LiveKit API credentials
const sipClient = new SipClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
);

async function runTest() {
  console.log('Starting direct SIP test');
  console.log('===================================');
  
  try {
    console.log('Checking existing SIP trunks...');
    const trunks = await sipClient.listSipInboundTrunk();
    console.log(`Found ${trunks.length} existing trunks`);
    
    for (const trunk of trunks) {
      console.log(`- Trunk: ${trunk.name} (ID: ${trunk.sipTrunkId})`);
      // Just display the full trunk object for debugging
      console.log('  Trunk details:', JSON.stringify(trunk, null, 2));
    }
    
    console.log('');
    console.log('Checking existing dispatch rules...');
    const rules = await sipClient.listSipDispatchRule();
    console.log(`Found ${rules.length} existing dispatch rules`);
    
    for (const rule of rules) {
      console.log(`- Rule: ${rule.name} (ID: ${rule.sipDispatchRuleId})`);
      // Just display the full rule object for debugging
      console.log('  Rule details:', JSON.stringify(rule, null, 2));
    }
    
    console.log('');
    console.log('Recreating SIP configuration...');
    
    // Delete any existing trunk with the name 'test-direct-trunk'
    const testTrunkName = 'test-direct-trunk';
    const existingTestTrunk = trunks.find(t => t.name === testTrunkName);
    if (existingTestTrunk) {
      console.log(`Deleting existing test trunk: ${testTrunkName}`);
      await sipClient.deleteSipTrunk(existingTestTrunk.sipTrunkId);
    }
    
    // Create a new test trunk
    console.log('Creating new test trunk');
    const newTrunk = await sipClient.createSipInboundTrunk(
      testTrunkName,
      [SPECIFIC_PHONE_NUMBER],
      {
        auth_username: SIP_USERNAME,
        auth_password: SIP_PASSWORD,
      },
    );
    console.log(`Test trunk created with ID: ${newTrunk.sipTrunkId}`);
    
    // Delete any existing rule with the name 'test-direct-rule'
    const testRuleName = 'test-direct-rule';
    const existingTestRule = rules.find(r => r.name === testRuleName);
    if (existingTestRule) {
      console.log(`Deleting existing test rule: ${testRuleName}`);
      await sipClient.deleteSipDispatchRule(existingTestRule.sipDispatchRuleId);
    }
    
    // Create a new test dispatch rule
    console.log('Creating new test dispatch rule');
    const newRule = await sipClient.createSipDispatchRule(
      {
        type: 'individual',
        roomPrefix: 'direct-test',
      },
      {
        name: testRuleName,
        trunkIds: [newTrunk.sipTrunkId],
      },
    );
    console.log(`Test dispatch rule created with ID: ${newRule.sipDispatchRuleId}`);
    
    console.log('');
    console.log('Test completed successfully!');
    console.log('===================================');
    console.log(`Your test SIP configuration is ready to accept calls to: ${SPECIFIC_PHONE_NUMBER}`);
    console.log('Please try making a call to this number now.');
    
  } catch (error) {
    console.error('Error during SIP test:', error);
  }
}

runTest().catch(console.error); 