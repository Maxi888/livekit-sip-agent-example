# Detailed Root Cause Analysis: Jambonz Call Routing Failure

## Executive Summary

Calls from Schmidtkom through Jambonz to LiveKit are failing because **Jambonz is not using the middleware's dial instructions**. Instead of routing calls to LiveKit as instructed by the middleware, Jambonz is attempting to route calls to `sip.jambonz.cloud` (itself), resulting in immediate failure.

## Evidence from PCAP Analysis

### What the PCAP Shows:
1. **Line 1**: INVITE to `sip:91874350352@sip.jambonz.cloud:transport=udp` (destination IP: 172.20.11.236)
2. **Line 6**: Response: `503 Try again later`
3. **Line 8**: Final response: `603 Decline`

### Critical Observations:
- The destination domain is `sip.jambonz.cloud` NOT `vocieagentpipelinetest-1z3kctsj.sip.livekit.cloud`
- The destination IP (172.20.11.236) appears to be Jambonz itself or another Jambonz component
- The call never reaches LiveKit's infrastructure

## Middleware Analysis

### What the Middleware is Doing Correctly:
From the logs at 07:35:38-39:
```
LiveKit simple webhook: incoming call
response: [{"verb":"dial","callerId":"004917645533966","answerOnBridge":true,"target":[{"type":"sip","sipUri":"sip:4991874350352@vocieagentpipelinetest-1z3kctsj.sip.livekit.cloud"}]}]
```

The middleware is:
1. ✅ Receiving webhook calls from Jambonz
2. ✅ Correctly formatting the phone number (adding 49 prefix)
3. ✅ Returning proper dial instructions to LiveKit
4. ✅ Using the correct SIP URI format

## Root Cause Identification

### The Problem: Jambonz Carrier Misconfiguration

Looking at your Jambonz configuration screenshots:

1. **Phone Number Configuration**:
   - Number: 4991874350352
   - Application: livekit_caller ✅
   - Carrier: Schmidkom ✅

2. **LiveKit SIP Carrier Configuration**:
   - Has TWO SIP gateways configured:
     - **Outbound**: `vocieagentpipelinetest-1z3kctsj.sip.livekit.cloud` ✅
     - **Inbound**: `0.0.0.0` with netmask 18 ❌

3. **The Critical Issue**: The inbound gateway configuration with `0.0.0.0/18` is problematic and may be causing routing confusion.

## Why This Configuration Causes the Problem

### Jambonz Call Flow:
1. Inbound call arrives from Schmidkom to Jambonz
2. Jambonz calls the webhook (`/livekit-simple`)
3. Webhook returns dial instructions
4. **BUT**: Jambonz appears to be ignoring the dial instructions and routing based on carrier configuration

### The Routing Logic Issue:
- The PCAP shows the call going to `sip.jambonz.cloud` instead of LiveKit
- This suggests Jambonz is using its own internal routing logic rather than following the webhook's dial instructions
- The presence of both inbound and outbound gateways in the LiveKit carrier may be confusing the routing engine

## Additional Configuration Issues

### 1. Application Type Mismatch
The application `livekit_caller` is configured with webhooks, but for carrier-based routing, Jambonz might expect a different application type or configuration.

### 2. Carrier Selection Logic
Jambonz appears to be selecting the wrong carrier or using the wrong gateway within the carrier configuration.

### 3. Missing Route Configuration
There may be a missing or misconfigured route that tells Jambonz how to handle calls to specific numbers.

## Why Previous Fixes Didn't Work

All previous fixes focused on LiveKit configuration:
- ✅ Trunk authentication
- ✅ IP whitelisting
- ✅ Number formatting
- ✅ Dispatch rules

But the **calls never reach LiveKit** because Jambonz isn't routing them there in the first place.

## Conclusion

The root cause is a **Jambonz routing configuration issue**. Despite the middleware returning correct dial instructions, Jambonz is not following them and is instead attempting to route calls to its own SIP domain (`sip.jambonz.cloud`). This is likely due to:

1. Misconfigured carrier settings (specifically the inbound gateway)
2. Incorrect application type or webhook handling
3. Missing or incorrect routing rules

The 503 error occurs because Jambonz cannot route the call to itself and has no valid destination.

## Recommended Next Steps

1. **Remove the inbound gateway** from the LiveKit carrier configuration (keep only outbound)
2. **Verify the application type** - ensure it's configured for webhook-based routing
3. **Check for any LCR (Least Cost Routing) rules** that might be overriding the webhook response
4. **Review Jambonz logs** to see why it's ignoring the webhook dial instructions
5. **Consider using a different webhook endpoint** specifically designed for carrier routing rather than simple dial 