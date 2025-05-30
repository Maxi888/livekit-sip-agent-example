# Retell-Style API Pre-Registration Implementation

## Overview
Successfully implemented the Retell approach for LiveKit SIP integration, eliminating the need for static inbound trunks and dispatch rules.

## Key Changes

### 1. Middleware (`/livekit-api` endpoint)
- Uses `createSipParticipant` API to pre-register calls
- Returns SIP URI with `sipCallId` format: `sip:SCL_xxx@domain`
- Includes retry logic (3 attempts with exponential backoff)
- Specifies agent with `agents: ['my-telephony-agent']` parameter

### 2. LiveKit Configuration
- **Removed**: All inbound trunks
- **Removed**: All dispatch rules  
- **Kept**: Outbound trunk `api-outbound-trunk` (required for API)

### 3. Call Flow
```
1. Jambonz → Middleware API
2. Middleware → createSipParticipant (pre-registers call)
3. Middleware → Returns sip:sipCallId@domain
4. Jambonz → Dials to LiveKit using sipCallId
5. LiveKit → Dispatches job to agent
```

## Benefits
- No more 503 errors from missing telephony workers
- No complex trunk/dispatch rule configuration
- Dynamic room creation with guaranteed agent dispatch
- Better error handling and retry logic

## Testing
```bash
# Test the API directly
curl -X POST https://jambonz-livekit-middleware-fd9b45a06ae5.herokuapp.com/livekit-api \
  -H "Content-Type: application/json" \
  -d '{"from": "+4917645533966", "to": "91874350352", "call_sid": "test-123", "account_sid": "test"}'
```

## Important Notes
- The `sipCallId` (like `SCL_xxx`) is the routing key, NOT the room name
- Agent must be specified in the `agents` parameter of `createSipParticipant`
- Outbound trunk is still required for the API to work
- No authentication needed in the dial command - API handles it 