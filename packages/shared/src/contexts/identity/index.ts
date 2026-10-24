// The `identity` context's shared contract: its schemas, API contract and route templates.
// Import it as `@workspace/shared/contexts/identity` to depend on this context alone; the root
// `@workspace/shared` barrel re-exports the same modules.

export * from "./contract";
export * from "./routes";
export * from "./schemas/auth-errors";
export * from "./schemas/auth";
export * from "./schemas/change-password";
export * from "./schemas/cookies";
export * from "./schemas/device-session";
export * from "./schemas/email-link-lifetimes";
export * from "./schemas/enrollment";
export * from "./schemas/identity-enums";
export * from "./schemas/login-verification";
export * from "./schemas/mfa-recovery";
export * from "./schemas/password";
export * from "./schemas/profile";
export * from "./schemas/session-status";
export * from "./schemas/token";
export * from "./schemas/two-factor";
export * from "./schemas/user";
export * from "./schemas/user-preferences";
