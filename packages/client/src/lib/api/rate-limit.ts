// What a client does with a 429 (ADR 071) — shared with the mobile app, so it lives in @workspace/api-client.

export { describeWait, isRateLimitError, rateLimitMessage, rateLimitRetryAfterSeconds } from "@workspace/api-client";
