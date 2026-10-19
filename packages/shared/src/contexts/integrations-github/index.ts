// The `integrations-github` context's shared contract: its schemas, API contract and route templates.
// Import it as `@workspace/shared/contexts/integrations-github` to depend on this context alone; the root
// `@workspace/shared` barrel re-exports the same modules.

export * from "./contract";
export * from "./routes";
export * from "./schemas/github-body-images";
export * from "./schemas/github-contributions";
export * from "./schemas/github-live-updates";
export * from "./schemas/github-pull-requests";
export * from "./schemas/github-reactions";
