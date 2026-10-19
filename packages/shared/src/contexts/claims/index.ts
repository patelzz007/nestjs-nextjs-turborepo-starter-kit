// The `claims` context's shared contract: its schemas, API contract and route templates.
// Import it as `@workspace/shared/contexts/claims` to depend on this context alone; the root
// `@workspace/shared` barrel re-exports the same modules.

export * from "./contract";
export * from "./routes";
export * from "./schemas/claim-availability";
export * from "./schemas/claim-enums";
export * from "./schemas/claim";
