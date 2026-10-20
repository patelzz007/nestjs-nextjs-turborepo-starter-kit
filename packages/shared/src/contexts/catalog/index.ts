// The `catalog` context's shared contract: its schemas, API contract and route templates.
// Import it as `@workspace/shared/contexts/catalog` to depend on this context alone; the root
// `@workspace/shared` barrel re-exports the same modules.

export * from "./contract";
export * from "./routes";
export * from "./schemas/catalog-fields";
export * from "./schemas/product";
export * from "./schemas/sample-category";
