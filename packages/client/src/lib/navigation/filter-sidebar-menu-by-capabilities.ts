// Moved to @workspace/shared (lib/navigation-menu), so the mobile app shares the one implementation;
// re-exported here so the web apps' imports stay as they are.
export { evaluateSidebarAuthorization, filterSidebarMenuData, filterCompiledSidebarMenu } from "@workspace/shared";
export type { SidebarFilterOptions, PermissionRequirement } from "@workspace/shared";
