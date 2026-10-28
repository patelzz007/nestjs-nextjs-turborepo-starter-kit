// The `authorization` context's shared contract: its schemas, API contract and route templates.
// Import it as `@workspace/shared/contexts/authorization` to depend on this context alone; the root
// `@workspace/shared` barrel re-exports the same modules.

export * from "./contract";
export * from "./routes";
export * from "./schemas/capabilities";
export * from "./schemas/permission-enums";
export * from "./schemas/permissions-registry";
export * from "./schemas/rbac-assignments";
export * from "./schemas/rbac-audit";
export * from "./schemas/rbac-groups";
export * from "./schemas/rbac-inspection";
export * from "./schemas/rbac-permissions";
export * from "./schemas/rbac-roles";
export * from "./schemas/rbac";
export * from "./schemas/tenant-access";
