// The `notifications` context's shared contract: its schemas, API contract and route templates.
// Import it as `@workspace/shared/contexts/notifications` to depend on this context alone; the root
// `@workspace/shared` barrel re-exports the same modules.

export * from "./contract";
export * from "./routes";
export * from "./schemas/email-templates";
export * from "./schemas/email";
