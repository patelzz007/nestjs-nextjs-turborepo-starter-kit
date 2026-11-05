// What the root `@workspace/shared` barrel exposes of the `operations` context (enhancement 8.2): a curated subset of
// this context's index. Its own contract object and route map stay behind the aggregated `apiContract` /
// `apiRoutes`, and its building-block schemas stay internal. Add a name here to make it part of the package's
// public surface (the export snapshot in src/contracts/__tests__/api-contract-shape.test.ts records it).

// Platform operations (ADR 068): servers, instances, dependencies, alerts.
export * from "./schemas/operations";
export * from "./percentiles";
export * from "./load-test-plan";
export * from "./machine-usage";
export * from "./schemas/traffic-and-cache";
export * from "./schemas/queues";
export * from "./schemas/status-page";
