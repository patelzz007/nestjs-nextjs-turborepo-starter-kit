// The `reference-data` context's shared contract: its schemas, API contract and route templates.
// Import it as `@workspace/shared/contexts/reference-data` to depend on this context alone; the root
// `@workspace/shared` barrel re-exports the same modules.

export * from "./contract";
export * from "./routes";
export * from "./schemas/geo-city";
export * from "./schemas/geo-country";
export * from "./schemas/geo-list-items";
export * from "./schemas/geo-region";
export * from "./schemas/geo-shared";
export * from "./schemas/geo-state";
export * from "./schemas/geo-subregion";
export * from "./schemas/geo-tools";
export * from "./schemas/geo";
