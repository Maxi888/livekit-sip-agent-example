# Final Root Cause Analysis: LiveKit 503 Service Unavailable

## Executive Summary

The latest PCAP reveals that calls ARE now reaching LiveKit successfully, but LiveKit is returning **503 Service Unavailable**. This is a significant improvement from earlier where calls were being routed to `sip.jambonz.cloud`. The root cause is now clearly on the LiveKit side.

## PCAP Analysis - Current State

### Call Flow Observed:
1. **Inbound leg** (Lines 1-3):
   - From: Schmidtkom (89.184.187.124)
   - To: Jambonz (172.20.11.236)
   - Request: `INVITE sip:91874350352@sip.jambonz.cloud`
   - Response: 100 Trying, then 183 Session in Progress

2. **Outbound leg** (Lines 4-7):
   - From: Jambonz (172.20.11.236)
   - To: LiveKit (129.158.233.108)
   - Request: `INVITE sip:4991874350352@vocieagentpipelinetest-1z3kctsj.sip.livekit.cloud`
   - Response: 100 Processing, then **503 Try again later**

3. **Call termination** (Line 8):
   - Jambonz sends 603 Decline back to Schmidtkom

### Key Observations:
- ✅ Jambonz is correctly forwarding to LiveKit
- ✅ The SIP URI format is correct: `sip:4991874350352@vocieagentpipelinetest-1z3kctsj.sip.livekit.cloud`
- ✅ LiveKit is receiving the call (responds with 100 Processing)
- ❌ LiveKit rejects with 503 Service Unavailable

## Root Cause Analysis

### Why LiveKit Returns 503

Based on the research and current configuration state:

1. **Multiple Conflicting Trunks**:
   - **ST_GjeZjGQjrsvC** - "Jambonz Inbound" (WITH authentication)
   - **ST_keiPmt6sJhJh** - "jambonz-inbound-persistent" (NO authentication)
   - Both accept the same number: 4991874350352

2. **Dispatch Rule Mismatch**:
   - **SDR_ZyY3ewVGtwEd** - Points to auth trunk, has agent "my-telephony-agent" configured
   - **SDR_HyMhj4T8greh** - Points to no-auth trunk, NO agent configured
   - **SDR_3mqGtt8QNX2x** - Points to non-existent trunk

3. **The Critical Issue**:
   When LiveKit receives a call to 4991874350352, it has TWO trunks that could handle it:
   - One expects authentication (which Jambonz isn't providing)
   - One doesn't expect authentication but has no agent configured in its dispatch rule

### LiveKit's Decision Process

When an inbound SIP call arrives:
1. LiveKit checks which trunk(s) accept the called number
2. If authentication is expected but not provided → 401/403 (but we're getting 503)
3. If no authentication is expected → proceed to dispatch rule
4. If dispatch rule has no agent configured AND no other agents are available → 503

### The 503 Specifically Indicates:

From the LiveKit SIP documentation and error patterns:
- **503 Service Unavailable** typically means:
  - No available resources to handle the call
  - No agent available to join the room
  - Dispatch rule created a room but no agent joined

## Why Previous Configuration Changes Helped

1. **Removing inbound gateway from Jambonz carrier**: This fixed the routing so calls now reach LiveKit
2. **Using phone number in SIP URI**: This ensures LiveKit can match the call to a trunk
3. **No authentication in middleware**: This matches one of the trunks (ST_keiPmt6sJhJh)

## The Remaining Problem

The dispatch rule (SDR_HyMhj4T8greh) for the no-auth trunk:
- Creates rooms with prefix "call-"
- Has NO specific agent configured
- The agent "my-telephony-agent" is running but not explicitly dispatched

Meanwhile, the other dispatch rule (SDR_ZyY3ewVGtwEd) that HAS the agent configured is linked to the wrong trunk (the one expecting auth).

## Verification

From the test output:
```
Rule: jambonz-dispatch-persistent (SDR_HyMhj4T8greh)
  Trunk IDs: ST_keiPmt6sJhJh
  Rule type: Direct
  No specific agent configured  ← This is the problem

Rule: Unnamed (SDR_ZyY3ewVGtwEd)
  Trunk IDs: ST_GjeZjGQjrsvC
  Rule type: Direct
  Configured agents:
    - Agent name: "my-telephony-agent"  ← Agent is here but wrong trunk
```

## Conclusion

LiveKit is returning 503 because:
1. The call matches the no-auth trunk (ST_keiPmt6sJhJh)
2. This trunk's dispatch rule creates a room but has no agent configured
3. The agent "my-telephony-agent" is running but not being dispatched to these rooms
4. LiveKit times out waiting for an agent to join and returns 503

The solution is to either:
- Update the dispatch rule SDR_HyMhj4T8greh to include the agent configuration
- Or delete the conflicting trunk/rules and create a clean configuration 