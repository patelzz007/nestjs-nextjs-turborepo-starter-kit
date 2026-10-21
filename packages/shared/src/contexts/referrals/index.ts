// The `referrals` context's shared contract: its schemas, API contract and route templates.
// Import it as `@workspace/shared/contexts/referrals` to depend on this context alone; the root
// `@workspace/shared` barrel re-exports the same modules.

export * from "./contract";
export * from "./routes";
export * from "./schemas/referral-enums";
export * from "./schemas/reward-referrals";
export * from "./schemas/signup-referral.constants";
export * from "./schemas/signup-referrals";
