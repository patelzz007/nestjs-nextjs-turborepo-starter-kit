// The `docs-publishing` context's shared contract (ADR 084). Import it as
// `@workspace/shared/contexts/docs-publishing` to depend on this context alone; the root `@workspace/shared`
// barrel re-exports its curated subset (root-exports.ts).

export * from "./docs-publishing.contract";
export * from "./docs-publishing.routes";
export * from "./schemas/docs-sync";
