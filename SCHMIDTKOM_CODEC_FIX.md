# Schmidtkom Codec Integration Fix Guide

## Root Cause Analysis

Based on the technical advice and your logs, the 503 errors are caused by:

1. **Codec Mismatch**: Schmidtkom uses G.711 μ-law (PCMU) at 8kHz, while LiveKit expects modern WebRTC codecs
2. **Missing Codec Negotiation**: Neither Jambonz nor the agent were configured for PCMU codec
3. **Dispatch Rule Configuration**: The dispatch rule didn't specify codec preferences

## Changes Implemented

### 1. Jambonz Middleware Enhancement (`livekit-jambonz-middleware/lib/routes/livekit.js`)
- Added codec configuration: `['PCMU', 'PCMA', 'telephone-event']`
- Ensures Jambonz tells LiveKit to expect G.711 codecs from Schmidtkom

### 2. Agent Codec Detection (`src/agent.ts`)
- Added detection for Schmidtkom calls
- Enhanced logging for codec information
- Prepared for codec-specific handling

### 3. Enhanced Dispatch Rule (`setup-dispatch-codec.js`)
- Configured dispatch rule with PCMU codec preference
- Added room metadata for codec handling
- Set sample rate to 8000Hz for G.711

## Deployment Steps

1. **Commit and deploy the changes:**
```bash
git add -A
git commit -m "Add PCMU codec support for Schmidtkom integration"
git push heroku-eu main
```

2. **Deploy Jambonz middleware updates:**
```bash
cd livekit-jambonz-middleware
git add -A
git commit -m "Add codec configuration to dial verb"
git push heroku main
```

3. **Update the dispatch rule:**
```bash
node setup-dispatch-codec.js
```

## Testing Procedure

1. Monitor agent logs:
```bash
heroku logs -a livekit-sip-agent-eu --tail
```

2. Make a test call and look for:
- "Detected Schmidtkom call - configuring for PCMU codec"
- "Room codecs: ["PCMU", "PCMA", "telephone-event"]"
- "Agent entry point called" (indicates room was created)

## Expected Call Flow

1. Schmidtkom → Jambonz (G.711 μ-law)
2. Jambonz → LiveKit (with codec: PCMU specified)
3. LiveKit creates room with PCMU codec support
4. Agent detects Schmidtkom call and handles PCMU
5. Audio flows properly in both directions

## Additional Debugging

If still getting 503 errors after these changes:

1. **Check LiveKit trunk configuration:**
```bash
lk sip inbound list
# Ensure trunk supports PCMU codec
```

2. **Verify Jambonz codec transcoding:**
```bash
heroku logs -a jambonz-livekit-middleware-fd9b45a06ae5 --tail | grep -i codec
```

3. **Enable LiveKit SIP debug logging** (contact LiveKit support for this)

## Alternative Solutions

If codec issues persist:

1. **Use Jambonz transcoding:**
   - Configure Jambonz to transcode PCMU → Opus before sending to LiveKit
   - Add `transcode: true` to dial verb

2. **Deploy media proxy:**
   - Use FreeSWITCH or Asterisk between Jambonz and LiveKit
   - Handle codec negotiation at proxy level

The codec mismatch is the most likely cause of your 503 errors based on Schmidtkom's legacy G.711 requirements. 