# Critical Findings: LiveKit SIP Integration Investigation

## 🚨 Key Discovery: Rooms Are Expiring

The rooms created by the middleware are **expiring before the SIP participant can join**. This explains why:
- Agent never receives jobs (no room = no job)
- Calls fail with 487 Request Terminated
- No participants ever join

## Timeline Analysis

1. **18:29:14.777** - Pre-registration completes
   - Room: `call-7570f6b4-7ec0-47a3-9c05-c36e08fd1874`
   - SIP Call ID: `SCL_xvn5eLAGGDD3`

2. **18:35:00** (approximately) - When checked
   - Room no longer exists
   - Expired within ~6 minutes

## Root Cause Hypothesis

### Primary Issue: Room Expiration
The room is created with `emptyTimeout: 300` (5 minutes), but the SIP participant never joins, causing:
1. Room expires after 5 minutes of being empty
2. When Jambonz tries to dial, the room might already be gone
3. LiveKit can't match the SIP call to a non-existent room

### Secondary Issue: SIP Connection Failure
Even within the 5-minute window, the SIP participant is not joining because:
1. **Authentication Mismatch**: Pre-registration includes auth, but Jambonz dial might not
2. **Header Mismatch**: Required headers might not be passed in the SIP INVITE
3. **Domain/Routing Issue**: The SIP call might not be reaching the right endpoint

## Evidence Summary

### What's Working ✅
- Room creation via API
- SIP participant pre-registration 
- Correct trunk domain usage
- Agent registration and readiness

### What's Failing ❌
- SIP participant never joins the room
- Rooms expire empty after 5 minutes
- No action callbacks from Jambonz
- Agent never receives jobs

## Critical Questions for LiveKit Support

1. **Why isn't the pre-registered SIP participant joining the room?**
   - Is there a specific SIP header format required?
   - Are there undocumented requirements for the INVITE?

2. **Is the room expiration normal behavior?**
   - Should the room persist longer when a participant is pre-registered?
   - Is there a way to extend the timeout?

3. **Can we see LiveKit's SIP logs?**
   - What happens when Jambonz sends the INVITE?
   - Is the sipCallId being matched correctly?

## Immediate Actions Needed

1. **Capture PCAP between Jambonz and LiveKit**
   - This will show exactly what's being sent
   - Can verify if authentication and headers are correct

2. **Test with Extended Room Timeout**
   - Increase `emptyTimeout` to 30 minutes for testing
   - See if timing is the issue

3. **Enable LiveKit Debug Logs**
   - Need visibility into why the SIP participant isn't joining
   - Check for authentication or routing errors

## Conclusion

The integration is failing at the final step - the pre-registered SIP participant is not joining the created room. This could be due to:
1. Missing/incorrect headers in the Jambonz INVITE
2. Authentication not being passed correctly
3. Timing issues with room expiration
4. Undocumented requirements for pre-registered participants

Without LiveKit's server-side logs or a PCAP of the Jambonz→LiveKit traffic, we cannot determine the exact cause. 