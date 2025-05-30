# Codec Integration Test Checklist

## What We Fixed

1. **Jambonz Middleware** - Added PCMU codec configuration to dial verb
2. **LiveKit Agent** - Added Schmidtkom call detection and codec logging
3. **Dispatch Rule** - Created rule with PCMU codec preference

## What to Look For When Testing

### In Agent Logs (`heroku logs -a livekit-sip-agent-eu`)

✅ **Success Indicators:**
- "Agent entry point called" - Room was created
- "Room codecs: ["PCMU", "PCMA", "telephone-event"]" - Codec info passed
- "Detected Schmidtkom call - configuring for PCMU codec" - Detection working
- "starting telephony agent for" - Agent handling the call

❌ **Failure Indicators:**
- No "Agent entry" logs after call - Room not created (still 503)
- "Room codecs: not specified" - Codec info not passed

### In Jambonz Logs (`heroku logs -a jambonz-livekit-middleware`)

Look for the dial verb with:
- `"codecs": ["PCMU", "PCMA", "telephone-event"]`
- `"auth": {"username": "livekit_client", "password": "..."}`

### Testing Steps

1. Make a call to +4991874350352
2. Monitor agent logs for "Agent entry point called"
3. If you see this message, the codec fix is working!
4. If not, we need to check LiveKit trunk codec support

## If Still Getting 503

The issue might be:
1. LiveKit trunk doesn't support PCMU codec
2. Need to enable codec transcoding in LiveKit
3. Need to contact LiveKit support to enable PCMU on the trunk

## Contact LiveKit Support With:

"We're using Schmidtkom (registration-based SIP provider) that only supports G.711 μ-law (PCMU) codec. 
We've configured:
- Jambonz to send codecs: ['PCMU', 'PCMA', 'telephone-event'] 
- Dispatch rule with PCMU preference
- But still getting 503 'Try again later'

Can you please:
1. Enable PCMU codec support on trunk ID: [GET FROM lk sip inbound list]
2. Check if our SIP endpoint supports G.711 codecs
3. Enable any necessary codec transcoding

Our LiveKit project: vocieagentpipelinetest-1z3kctsj" 