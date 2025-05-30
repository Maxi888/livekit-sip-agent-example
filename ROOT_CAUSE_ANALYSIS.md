# Root Cause Analysis: LiveKit SIP 503 Service Unavailable Error

## Executive Summary
Despite all configuration changes, calls from Schmidtkom through Jambonz to LiveKit continue to fail with SIP status 503 (Service Unavailable). The root cause is that the Jambonz middleware is not sending authentication credentials when dialing to LiveKit, even though the LiveKit trunk is configured to require authentication.

## Detailed Analysis

### 1. Current Configuration State

#### LiveKit Trunk Configuration (from check-livekit-trunks.js output):
```
Trunk ID: ST_GjeZjGQjrsvC
Name: Jambonz Inbound
Numbers: 4991874350352
Allowed addresses: 54.236.168.131
Allowed numbers: 4991874350352
Auth username: livekit_client
Krisp enabled: false
```

The trunk is configured with:
- Authentication required (username: `livekit_client`)
- Restricted to accept calls only from Jambonz IP: `54.236.168.131`
- Configured to accept calls TO number: `4991874350352`
- Configured to accept calls FROM number: `4991874350352`

#### Dispatch Rule Configuration:
```
Rule ID: SDR_ZyY3ewVGtwEd
Trunk IDs: ST_GjeZjGQjrsvC
Rule type: {"dispatchRuleIndividual":{"roomPrefix":"call-","pin":""}}
```

### 2. Call Flow Analysis

From the middleware logs:
1. Call arrives from Schmidtkom to Jambonz with destination `91874350352`
2. Middleware formats the number to `+4991874350352`
3. Middleware creates a LiveKit call ID (e.g., `call-afd968a1ba780364`)
4. Middleware attempts to dial: `sip:call-afd968a1ba780364@vocieagentpipelinetest-1z3kctsj.sip.livekit.cloud`
5. **Call fails with 503 Service Unavailable**

### 3. Root Cause Identification

#### The Problem:
The Jambonz middleware is NOT sending authentication credentials when dialing to LiveKit.

Looking at the dial configuration in `livekit-jambonz-middleware/lib/routes/livekit.js` (lines 130-143):
```javascript
session
  .dial({
    callerId: from,
    answerOnBridge: true,
    anchorMedia: true,
    referHook: '/refer',
    actionHook: '/dialAction',
    target,
    headers
  })
  .hangup()
  .send();
```

The `dial` verb is missing the `auth` property that should contain the authentication credentials.

#### Why This Causes 503:
1. LiveKit trunk requires authentication (username: `livekit_client`)
2. Jambonz sends the INVITE without authentication headers
3. LiveKit responds with 401 Unauthorized (likely)
4. Jambonz doesn't handle the authentication challenge
5. The call fails and Jambonz reports it as 503 Service Unavailable

### 4. Supporting Evidence

From Jambonz documentation on the `dial` verb for SIP endpoints:
```javascript
{
  "type": "sip",
  "sipUri": "sip:1617333456@sip.trunk1.com",
  "auth": {
    "username": "foo",
    "password": "bar"
  }
}
```

The middleware needs to include the `auth` object in the target configuration when dialing to LiveKit.

### 5. Why Previous Fixes Didn't Work

All previous configuration changes addressed symptoms but not the root cause:
- IP whitelisting ✓ (correctly set to Jambonz IP)
- Phone number format ✓ (correctly formatted without +)
- Trunk numbers field ✓ (correctly configured)
- Dispatch rule ✓ (correctly configured)
- Agent registration ✓ (agent is running and registered)

However, none of these fixes addressed the missing authentication in the outbound dial from Jambonz to LiveKit.

### 6. Additional Observations

1. **No Agent Logs**: The agent logs show no incoming calls because the calls never reach LiveKit due to authentication failure.

2. **Misleading Error Code**: The 503 error is misleading - it suggests a service availability issue when the actual problem is authentication.

3. **Missing Environment Variables**: The middleware doesn't have LiveKit SIP credentials configured as environment variables, which it would need to authenticate.

## Conclusion

The root cause is that the Jambonz middleware is not configured to send authentication credentials when dialing to LiveKit's SIP trunk. The LiveKit trunk requires authentication, and without it, all calls are rejected before they can reach the LiveKit system or the agent.

## Recommended Solution

The middleware needs to be updated to:
1. Add environment variables for LiveKit SIP credentials:
   - `LIVEKIT_SIP_USERNAME=livekit_client`
   - `LIVEKIT_SIP_PASSWORD=<password>`

2. Modify the dial target to include authentication:
```javascript
target = [
  {
    type: 'sip',
    sipUri: `sip:${livekit_call_id}@${sipDomain}`,
    auth: {
      username: process.env.LIVEKIT_SIP_USERNAME,
      password: process.env.LIVEKIT_SIP_PASSWORD
    }
  }
];
```

This will allow Jambonz to properly authenticate with LiveKit's SIP trunk and complete the call. 