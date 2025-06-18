import { SipClient } from 'livekit-server-sdk';

// LiveKit configuration
const LIVEKIT_URL = 'wss://vocieagentpipelinetest-1z3kctsj.livekit.cloud';
const LIVEKIT_API_KEY = 'APIT7AdAjtqf3oA';
const LIVEKIT_API_SECRET = 'tDOrcAXqa9ngwGiwhBe338fY7eaL6wTmPe63yfbgWAcF';

async function createSimpleDispatchRule() {
  try {
    const sipClient = new SipClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    
    console.log('🔍 Getting trunk IDs...');
    const [inboundTrunks] = await Promise.all([
      sipClient.listSipInboundTrunk(),
    ]);
    
    const allTrunkIds = inboundTrunks.map(t => t.sipTrunkId);
    console.log(`Trunk IDs: [${allTrunkIds.join(', ')}]`);
    
    // Test with minimal required fields
    const createRequest = {
      rule: {
        dispatchRuleIndividual: {
          roomPrefix: 'call-'
        }
      },
      trunkIds: allTrunkIds,
      name: 'Test Rule'
    };
    
    console.log('📤 Sending request:', JSON.stringify(createRequest, null, 2));
    
    const newRule = await sipClient.createSipDispatchRule(createRequest);
    
    console.log('✅ SUCCESS! Created rule:', newRule.sipDispatchRuleId);
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

createSimpleDispatchRule(); 