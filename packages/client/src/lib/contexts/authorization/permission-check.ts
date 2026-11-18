// The capability-slug helpers the navigation menus use (@workspace/shared lib/navigation-menu); re-exported
// here so the web apps' imports stay as they are. Showing and hiding UI uses the CASL ability instead
// (`./index.tsx`: `<Can>`, `useAbility()`).
export { createGrantedCapabilities, isCapabilityGranted, isKnownPermissionSlug } from "@workspace/shared";
export type { CapabilityCheckMode, GrantedCapabilities } from "@workspace/shared";
