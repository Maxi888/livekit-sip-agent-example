# Root Cause Analysis: LiveKit SIP Integration Failure

## Executive Summary
Calls are failing because the SIP INVITE from Jambonz to LiveKit is being rejected with **487 Request Terminated** after just 1.3 seconds. Despite successful pre-registration and room creation, the SIP participant never joins the room, preventing the agent from receiving any jobs.

## Timeline of a Failed Call

### 1. **Initial Call Setup (Success)**
- Schmidtkom → Jambonz: INVITE received
- Jambonz → Middleware: Webhook request to `/livekit-api`
- Middleware creates room successfully
- Middleware pre-registers SIP participant via `createSipParticipant`
- Returns SIP URI: `sip:SCL_xvn5eLAGGDD3@vocieagentpipelinetest-1z3kctsj.sip.livekit.cloud`

### 2. **Jambonz Dial Attempt (Failure)**
- Jambonz receives dial instruction with SIP URI
- Jambonz → LiveKit: Sends INVITE to the pre-registered SIP URI
- **Issue**: Call terminates after 1.3 seconds with 487 Request Terminated
- No action callback received by middleware
- No participant joins the room
- Agent never receives a job

## Key Findings

### 1. **Pre-Registration Working**
- ✅ Rooms are created successfully
- ✅ SIP participants are pre-registered with valid `sipCallId`
- ✅ Correct trunk domain is being used
- ✅ All LiveKit support recommendations implemented

### 2. **SIP Connection Failing**
- ❌ SIP INVITE from Jambonz is not being accepted by LiveKit
- ❌ No participants join the created rooms
- ❌ Rooms remain empty and eventually expire
- ❌ Agent sits idle with no jobs

### 3. **Missing Action Callbacks**
- No `/action` callbacks received from Jambonz
- This indicates the dial operation is failing at the SIP level
- The 487 error suggests the call is being cancelled/terminated

## Potential Root Causes

### 1. **SIP Header Mismatch**
The pre-registered participant expects specific headers that Jambonz might not be sending:
- Missing `X-LiveKit-Call-ID` header in the actual INVITE
- Missing `X-LiveKit-Project` header
- Authentication headers not matching

### 2. **SIP URI Format Issue**
While we're generating `sip:SCL_xxx@domain`, LiveKit might expect:
- Different URI format
- Additional parameters in the URI
- Different authentication mechanism

### 3. **Media Negotiation Failure**
From the PCAP:
- Schmidtkom offers: G722, PCMA, PCMU
- LiveKit might not support the offered codecs
- Media anchoring through Jambonz might be causing issues

### 4. **Timing Issue**
- Pre-registration might be expiring too quickly
- Race condition between room creation and SIP INVITE
- LiveKit might need more time to set up the participant

### 5. **Network/Firewall Issue**
- Jambonz might not be able to reach LiveKit's SIP endpoint
- TLS/SRTP requirements not being met
- Port restrictions

## Evidence from Logs

### Middleware Success:
```json
{
  "sipUri": "sip:SCL_xvn5eLAGGDD3@vocieagentpipelinetest-1z3kctsj.sip.livekit.cloud",
  "roomName": "call-7570f6b4-7ec0-47a3-9c05-c36e08fd1874",
  "msg": "Room created successfully"
}
```

### But No Agent Activity:
- Last agent log: "registered worker" at 13:57
- No job received logs since then
- No participant joined events

### Active Calls Accumulating:
- 9 calls tracked in middleware
- No action callbacks to clean them up
- Suggests all calls are failing at SIP level

## Critical Questions

1. **Is Jambonz actually sending the INVITE to LiveKit?**
   - Need PCAP between Jambonz and LiveKit
   - Check Jambonz logs for dial errors

2. **Are the headers being passed correctly?**
   - The dial instruction includes headers, but are they sent in the SIP INVITE?
   - LiveKit might require headers in a specific format

3. **Is the pre-registration actually working?**
   - The API returns success, but is the participant really registered?
   - Can we query LiveKit to verify the participant exists?

4. **Is there a trunk configuration mismatch?**
   - The trunk expects certain authentication
   - Jambonz might not be sending the right credentials

## Next Steps

1. **Get PCAP between Jambonz and LiveKit**
   - This will show exactly what's being sent
   - Can verify headers, authentication, and response codes

2. **Enable Debug Logging**
   - LiveKit server logs might show why it's rejecting the call
   - Jambonz logs might show dial errors

3. **Test Direct SIP**
   - Try calling the pre-registered SIP URI directly with a SIP client
   - This would isolate if it's a Jambonz issue or LiveKit issue

4. **Verify Trunk Configuration**
   - The outbound trunk might need specific settings
   - Authentication might not be configured correctly

5. **Check LiveKit Documentation**
   - There might be undocumented requirements for pre-registered calls
   - The API might have changed

## Conclusion

The integration is 90% working - pre-registration succeeds, rooms are created, and the agent is ready. The failure point is the actual SIP connection between Jambonz and LiveKit. The 487 error after 1.3 seconds suggests either:
1. LiveKit is rejecting the call due to missing/incorrect headers
2. Media negotiation is failing
3. Authentication is failing at the SIP level

Without visibility into the Jambonz→LiveKit SIP traffic, we cannot determine the exact cause. 