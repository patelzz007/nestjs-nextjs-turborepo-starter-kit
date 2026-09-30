import { z } from "zod";

import { CapabilitySlugSchema } from "@workspace/shared";

import { isKnownPermissionSlug } from "../auth/permission-check";

/** Requirement evaluation mode: every permission (all) or at least one (any). */
export const SidebarPermissionModeSchema = z.enum(["all", "any"]);

export type SidebarPermissionMode = z.output<typeof SidebarPermissionModeSchema>;

/**
 * A persisted capability slug in menu config. Platform slugs must resolve to a
 * known `(action, resource)` pair, so a typo fails at load instead of hiding
 * the item forever.
 */
export const SidebarPermissionSlugSchema = CapabilitySlugSchema.refine(isKnownPermissionSlug, {
	message: "Unknown permission slug — use a PERMISSION.<RESOURCE>.<ACTION> value",
});

/** Feature-flag key gating an item independently of authorization. */
export const SidebarFeatureFlagSchema = z.string().min(1);

/**
 * Declarative authorization for a sidebar item (spec §16).
 *
 * - `permissions` — capability slugs required to see the item.
 * - `mode` — "all" (AND) or "any" (OR, default).
 * - `cascade` — when true, this requirement applies to the entire subtree;
 *   a denied subtree is removed including the parent node.
 */
export const SidebarAuthorizationSchema = z
	.object({
		permissions: z.array(SidebarPermissionSlugSchema).min(1),
		mode: SidebarPermissionModeSchema.optional(),
		cascade: z.boolean().optional(),
	})
	.strict();

export type SidebarAuthorization = z.output<typeof SidebarAuthorizationSchema>;

export interface SidebarMenuItemNode {
	readonly title: string;
	readonly url: string;
	readonly icon?: string;
	readonly disabled?: boolean;
	readonly authorization?: SidebarAuthorization;
	readonly featureFlag?: string;
	readonly children?: readonly SidebarMenuItemNode[];
}

export const SidebarMenuItemSchema: z.ZodType<SidebarMenuItemNode> = z.lazy(() =>
	z
		.object({
			title: z.string().min(1),
			url: z.string(),
			icon: z.string().optional(),
			disabled: z.boolean().optional(),
			authorization: SidebarAuthorizationSchema.optional(),
			featureFlag: SidebarFeatureFlagSchema.optional(),
			children: z.array(z.lazy(() => SidebarMenuItemSchema)).optional(),
		})
		.strict(),
);

export type SidebarMenuItem = z.output<typeof SidebarMenuItemSchema>;

export const SidebarMenuSectionColorSchema = z.enum(["blue", "green", "amber", "rose", "purple", "teal"]);

export type SidebarMenuSectionColor = z.output<typeof SidebarMenuSectionColorSchema>;

export const SidebarMenuSectionSchema = z
	.object({
		title: z.string().min(1),
		color: SidebarMenuSectionColorSchema.optional(),
		items: z.array(SidebarMenuItemSchema),
	})
	.strict();

export type SidebarMenuSection = z.output<typeof SidebarMenuSectionSchema>;

export const SidebarMenuHeaderSchema = z
	.object({
		title: z.string().min(1),
		subtitle: z.string(),
	})
	.strict();

export type SidebarMenuHeader = z.output<typeof SidebarMenuHeaderSchema>;

/**
 * Raw sidebar menu JSON — parsed at app startup before loading into the
 * zustand store. Every level is `.strict()`: an unknown or misspelled key
 * (e.g. `authorisation`) fails loudly at load instead of being silently
 * stripped, which would make a gated item public.
 */
export const SidebarMenuDataSchema = z
	.object({
		header: SidebarMenuHeaderSchema,
		sections: z.array(SidebarMenuSectionSchema),
		bottomItems: z.array(SidebarMenuItemSchema),
	})
	.strict();

export type SidebarMenuData = z.output<typeof SidebarMenuDataSchema>;

export interface CompiledSidebarMenuItemNode {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly icon?: string;
	readonly disabled?: boolean;
	readonly authorization?: SidebarAuthorization;
	readonly featureFlag?: string;
	readonly children?: readonly CompiledSidebarMenuItemNode[];
}

export const CompiledSidebarMenuItemSchema: z.ZodType<CompiledSidebarMenuItemNode> = z.lazy(() =>
	z
		.object({
			id: z.string().min(1),
			title: z.string().min(1),
			url: z.string(),
			icon: z.string().optional(),
			disabled: z.boolean().optional(),
			authorization: SidebarAuthorizationSchema.optional(),
			featureFlag: SidebarFeatureFlagSchema.optional(),
			children: z.array(z.lazy(() => CompiledSidebarMenuItemSchema)).optional(),
		})
		.strict(),
);

export type CompiledSidebarMenuItem = z.output<typeof CompiledSidebarMenuItemSchema>;

export const CompiledSidebarMenuSectionSchema = z.object({
	title: z.string().min(1),
	color: SidebarMenuSectionColorSchema.optional(),
	items: z.array(CompiledSidebarMenuItemSchema).readonly(),
});

export type CompiledSidebarMenuSection = z.output<typeof CompiledSidebarMenuSectionSchema>;

export const CompiledSidebarMenuDataSchema = z
	.object({
		header: SidebarMenuHeaderSchema,
		sections: z.array(CompiledSidebarMenuSectionSchema),
		bottomItems: z.array(CompiledSidebarMenuItemSchema).readonly(),
	})
	.strict();

export type CompiledSidebarMenuData = z.output<typeof CompiledSidebarMenuDataSchema>;
