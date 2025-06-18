import { SipClient } from 'livekit-server-sdk';

// LiveKit configuration
const LIVEKIT_URL = 'wss://vocieagentpipelinetest-1z3kctsj.livekit.cloud';
const LIVEKIT_API_KEY = 'APIT7AdAjtqf3oA';
const LIVEKIT_API_SECRET = 'tDOrcAXqa9ngwGiwhBe338fY7eaL6wTmPe63yfbgWAcF';

async function fixDispatchRule() {
  try {
    const sipClient = new SipClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    
    console.log('🔍 Getting current configuration...');
    
    // Get current trunks and dispatch rules
    const [inboundTrunks, outboundTrunks, dispatchRules] = await Promise.all([
      sipClient.listSipInboundTrunk(),
      sipClient.listSipOutboundTrunk(), 
      sipClient.listSipDispatchRule()
    ]);
    
    console.log('\n📋 Current Configuration:');
    console.log('Inbound Trunks:', inboundTrunks.length);
    inboundTrunks.forEach(trunk => {
      console.log(`  - ${trunk.sipTrunkId}: ${trunk.name} (${trunk.numbers?.join(', ')})`);
    });
    
    console.log('Outbound Trunks:', outboundTrunks.length);
    outboundTrunks.forEach(trunk => {
      console.log(`  - ${trunk.sipTrunkId}: ${trunk.name} (${trunk.numbers?.join(', ')})`);
    });
    
    console.log('Dispatch Rules:', dispatchRules.length);
    dispatchRules.forEach((rule, index) => {
      console.log(`\n  Rule ${index + 1}:`);
      console.log(`    ID: ${rule.sipDispatchRuleId}`);
      console.log(`    Trunk IDs: [${rule.trunkIds?.join(', ') || 'EMPTY!'}]`);
      console.log(`    Agent: ${rule.roomConfig?.agents?.[0]?.agentName || 'None'}`);
    });
    
    // Find the dispatch rule to update (should be the only one)
    const targetRule = dispatchRules[0]; // Take the first (and likely only) rule
    
    if (!targetRule) {
      throw new Error('No dispatch rules found');
    }
    
    console.log(`\n🎯 Found dispatch rule: ${targetRule.sipDispatchRuleId}`);
    console.log(`Current trunk IDs: [${targetRule.trunkIds?.join(', ') || 'EMPTY'}]`);
    
    // Collect all inbound trunk IDs 
    const allTrunkIds = inboundTrunks.map(t => t.sipTrunkId);
    
    console.log(`\n🔧 Will update dispatch rule to include trunk IDs: [${allTrunkIds.join(', ')}]`);
    
    // Update the dispatch rule with proper configuration
    const updateRequest = {
      sipDispatchRuleId: targetRule.sipDispatchRuleId, // Use correct field name
      trunkIds: allTrunkIds, // Add all inbound trunk IDs
      name: targetRule.name || 'Default Dispatch Rule',
      metadata: targetRule.metadata || '',
      // Keep existing rule and roomConfig
      rule: targetRule.rule,
      roomConfig: targetRule.roomConfig,
      hidePhoneNumber: targetRule.hidePhoneNumber,
      inboundNumbers: targetRule.inboundNumbers,
      attributes: targetRule.attributes,
      roomPreset: targetRule.roomPreset,
      krispEnabled: targetRule.krispEnabled,
      mediaEncryption: targetRule.mediaEncryption
    };
    
    console.log('\n⚡ Updating dispatch rule...');
    console.log('Update request trunk IDs:', updateRequest.trunkIds);
    
    // Check available methods
    console.log('\nAvailable SIP methods:');
    Object.getOwnPropertyNames(Object.getPrototypeOf(sipClient))
      .filter(name => name.includes('Sip') || name.includes('Dispatch'))
      .forEach(method => console.log(`  - ${method}`));
    
    // Try different method names
    let updatedRule;
    if (typeof sipClient.updateSipDispatchRule === 'function') {
      updatedRule = await sipClient.updateSipDispatchRule(updateRequest);
    } else if (typeof sipClient.modifySipDispatchRule === 'function') {
      updatedRule = await sipClient.modifySipDispatchRule(updateRequest);
    } else {
      // Try deletion and recreation
      console.log('\n🔄 Recreating dispatch rule...');
      await sipClient.deleteSipDispatchRule({ sip_dispatch_rule_id: targetRule.sipDispatchRuleId });
      
      const createRequest = {
        trunk_ids: allTrunkIds, // Use snake_case for API
        name: targetRule.name || 'Default Dispatch Rule',
        metadata: targetRule.metadata || '',
        // Keep existing rule and roomConfig
        rule: targetRule.rule,
        room_config: targetRule.roomConfig, // Use snake_case
        hide_phone_number: targetRule.hidePhoneNumber,
        inbound_numbers: targetRule.inboundNumbers,
        attributes: targetRule.attributes,
        room_preset: targetRule.roomPreset,
        krisp_enabled: targetRule.krispEnabled,
        media_encryption: targetRule.mediaEncryption
      };
      
      updatedRule = await sipClient.createSipDispatchRule(createRequest);
    }
    
    console.log('✅ SUCCESS! Dispatch rule updated:');
    console.log(`  - Rule ID: ${updatedRule.sipDispatchRuleId}`);
    console.log(`  - Name: ${updatedRule.name}`);
    console.log(`  - Trunk IDs: [${updatedRule.trunkIds?.join(', ')}]`);
    console.log(`  - Agent: ${updatedRule.roomConfig?.agents?.[0]?.agentName}`);
    
    console.log('\n🎉 FIXED! Both Twilio and Jambonz calls should now be dispatched to the agent.');
    console.log('\n📞 TEST NOW:');
    console.log('  1. Call Twilio number: +49 89 62828048 (should still work)');
    console.log('  2. Call Jambonz number: +49 9187 4350352 (should now work!)');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixDispatchRule(); 