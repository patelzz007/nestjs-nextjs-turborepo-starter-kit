// Moved to @workspace/shared (lib/navigation-menu), so the mobile app shares the one implementation;
// re-exported here so the web apps' imports stay as they are.
export {
	SidebarPermissionModeSchema,
	SidebarPermissionSlugSchema,
	SidebarLabelKeySchema,
	SidebarFeatureFlagSchema,
	SidebarAuthorizationSchema,
	SidebarMenuItemSchema,
	SidebarMenuSectionColorSchema,
	SidebarMenuSectionSchema,
	SidebarMenuHeaderSchema,
	SidebarMenuDataSchema,
	CompiledSidebarMenuItemSchema,
	CompiledSidebarMenuSectionSchema,
	CompiledSidebarMenuDataSchema,
} from "@workspace/shared";
export type {
	SidebarPermissionMode,
	SidebarAuthorization,
	SidebarMenuItemNode,
	SidebarMenuItem,
	SidebarMenuSectionColor,
	SidebarMenuSection,
	SidebarMenuHeader,
	SidebarMenuData,
	CompiledSidebarMenuItemNode,
	CompiledSidebarMenuItem,
	CompiledSidebarMenuSection,
	CompiledSidebarMenuData,
} from "@workspace/shared";
