// Moved to @workspace/shared (lib/navigation-menu), so the mobile app shares the one implementation;
// re-exported here so the web apps' imports stay as they are.
export { createAuthorizationChecker, createGrantedCapabilities, isCapabilityGranted, isKnownPermissionSlug, meetsRequirement } from "@workspace/shared";
export type { AuthorizationChecker, CanRequirement, CapabilityCheckMode, GrantedCapabilities } from "@workspace/shared";
