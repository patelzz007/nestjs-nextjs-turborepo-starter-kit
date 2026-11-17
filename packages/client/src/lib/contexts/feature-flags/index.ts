// The client feature-flags context's public surface (ADR 087): other contexts and the apps import only this file.
// Reading a bundle (`isFlagOn`, `configValueOf`) and batching exposures are shared with the mobile app, so they live
// in `@workspace/shared`. The hooks and the fixed-bundle provider (feature-flags-context) don't touch the API; the live
// provider does.
export * from "./device-id";
export * from "./feature-flags-context";
export * from "./feature-flags-provider";
