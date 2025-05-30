# LiveKit Telephony Agent Deployment Guide

## Changes Made

Based on LiveKit support's analysis, I've implemented the following changes to make your agent telephony-capable:

### 1. Agent Telephony Configuration (src/agent.ts)
- Added explicit agent name configuration: `my-telephony-agent`
- Enhanced logging to track SIP participant detection
- Added debug mode for better visibility
- Configured proper WorkerOptions for telephony support

### 2. Combined Agent Updates (src/combined-agent-sip.ts)
- Updated to run agent in `dev` mode for proper worker registration
- Added telephony-specific status endpoints
- Enhanced logging to show agent name and mode

### 3. Dispatch Rule Script (setup-dispatch-rule.js)
- Created a script to configure SIP dispatch rules
- Explicitly dispatches `my-telephony-agent` to SIP rooms
- Sets room prefix as `sip-call-` for telephony calls

## Deployment Steps

### Step 1: Deploy Updated Agent to Heroku

```bash
git add .
git commit -m "Add telephony capabilities to LiveKit agent"
git push heroku main
```

### Step 2: Configure SIP Dispatch Rule

Run the dispatch rule setup script:

```bash
node setup-dispatch-rule.js
```

This will:
- Find your SIP trunk with phone number 91874350352
- Create a dispatch rule that sends calls to `my-telephony-agent`
- Configure rooms with prefix `sip-call-`

### Step 3: Verify Agent Registration

Check Heroku logs to ensure the agent is registering properly:

```bash
heroku logs -a livekit-sip-agent-eu --tail
```

Look for:
- "registered worker" with id "AW_xxx"
- "agentName": "my-telephony-agent"
- No connection errors

### Step 4: Test the Setup

1. Make a test call to your phone number: +4991874350352
2. Monitor the logs for:
   - Jambonz receiving the call
   - Authentication success (no 401/407)
   - LiveKit accepting the call (100 Processing)
   - Agent dispatch and connection

## Troubleshooting

### If you still get 503 errors:

1. **Verify agent is running:**
   ```bash
   heroku ps -a livekit-sip-agent-eu
   ```

2. **Check dispatch rules:**
   ```bash
   lk sip dispatch list
   ```
   Ensure `my-telephony-agent` is listed in the agent configuration

3. **Verify trunk configuration:**
   ```bash
   lk sip inbound list
   ```
   Check that authentication is properly configured

### Expected Log Flow

1. **Jambonz receives call:**
   ```
   "from":"004917645533966","to":"91874350352"
   ```

2. **Jambonz sends authenticated request to LiveKit:**
   ```
   "auth":{"username":"livekit_client","password":"syzhod-2xasMe-wumrag"}
   ```

3. **LiveKit accepts and dispatches agent:**
   ```
   100 Processing
   Agent entry point called
   Job info: {"agentName":"my-telephony-agent"}
   ```

4. **Agent connects to room:**
   ```
   Successfully connected to LiveKit
   SIP participant detected!
   ```

## Key Points

- **Agent Name:** `my-telephony-agent` enables explicit dispatch
- **Room Prefix:** `sip-call-` for telephony rooms
- **Authentication:** Working correctly with provided credentials
- **503 Resolution:** Agent now advertises telephony capabilities

## Next Steps

1. Deploy and test the changes
2. Monitor logs during test calls
3. If issues persist, share the new logs with LiveKit support

The main issue was that LiveKit couldn't find a telephony-capable worker. With these changes, your agent now:
- Has an explicit name for dispatch
- Runs in dev mode for proper registration
- Is configured in the dispatch rule
- Advertises telephony capabilities

This should resolve the 503 "Try again later" errors! 