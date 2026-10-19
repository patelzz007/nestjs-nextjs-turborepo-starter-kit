// The `rewards` context's shared contract: its schemas, API contract and route templates.
// Import it as `@workspace/shared/contexts/rewards` to depend on this context alone; the root
// `@workspace/shared` barrel re-exports the same modules.

export * from "./contract";
export * from "./routes";
export * from "./schemas/reward-enums";
export * from "./schemas/reward-legal";
export * from "./schemas/reward";
