// The navigation menu model every app shares (the web sidebars, the mobile drawer): its zod schema
// (nested items, any depth, each with an optional capability requirement), the compiler that gives
// each item a stable id, and the recursive filter that keeps only what the session's capabilities
// allow (structural parents, `cascade`, feature flags). Framework-free, so React, React Native and the
// tests share one implementation; the API still checks every request.

export * from "./permission-check";
export * from "./sidebar-menu-schema";
export * from "./sidebar-menu-compile";
export * from "./filter-sidebar-menu-by-capabilities";
export * from "./apply-menu-authorization";
