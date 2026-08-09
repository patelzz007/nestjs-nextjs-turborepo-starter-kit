import type { LucideIcon } from "lucide-react";
import { z } from "zod";

/**
 * A single sidebar navigation item.
 *
 * `children` is recursive — an item can nest up to any depth. The recursive
 * renderer in `sidebar.tsx` walks this tree at render time, so there is
 * nothing hardcoded per level here.
 *
 * The schema is anchored to a node type (zod can't infer a self-referencing
 * schema's own type) and the exported alias is derived with `z.output` —
 * rule 5, no hand-written type next to the schema. The anchor is exported
 * purely because TypeScript's declaration emit needs to NAME it when another
 * module exports a schema that references `SidebarMenuItemSchema`.
 */
export interface SidebarMenuItemNode {
	readonly title: string;
	readonly url: string;
	readonly icon?: string;
	readonly disabled?: boolean;
	readonly children?: readonly SidebarMenuItemNode[];
}

export const SidebarMenuItemSchema: z.ZodType<SidebarMenuItemNode> = z.lazy(() =>
	z.object({
		title: z.string().min(1),
		url: z.string(),
		icon: z.string().optional(),
		disabled: z.boolean().optional(),
		children: z.array(z.lazy(() => SidebarMenuItemSchema)).optional(),
	}),
);

export type SidebarMenuItem = z.output<typeof SidebarMenuItemSchema>;

export const SidebarMenuSectionSchema = z.object({
	title: z.string().min(1),
	items: z.array(SidebarMenuItemSchema),
});

export type SidebarMenuSection = z.output<typeof SidebarMenuSectionSchema>;

export const SidebarMenuHeaderSchema = z.object({
	title: z.string().min(1),
	subtitle: z.string(),
});

export type SidebarMenuHeader = z.output<typeof SidebarMenuHeaderSchema>;

/**
 * The full shape of `apps/admin/lib/navigation/sidebar-menu.json`.
 *
 * Strictness is deliberately ASYMMETRIC:
 * - This top-level schema is `.strict()` — a renamed/removed top-level key
 *   fails loudly at module load instead of silently rendering a broken menu.
 * - Item schemas (`SidebarMenuItemSchema` etc.) are non-strict — they may gain
 *   keys (e.g. a future `badge` field) without breaking startup; unknown item
 *   keys are stripped, not rejected.
 *
 * Consequence: ADDING a new top-level key requires updating this schema first,
 * or the whole admin app refuses to boot (server + client bundles both parse).
 */
export const SidebarMenuDataSchema = z
	.object({
		header: SidebarMenuHeaderSchema,
		sections: z.array(SidebarMenuSectionSchema),
		bottomItems: z.array(SidebarMenuItemSchema),
	})
	.strict();

export type SidebarMenuData = z.output<typeof SidebarMenuDataSchema>;

/**
 * A nav item with its **unique compiled id** attached (see
 * `lib/navigation/sidebar-menu.ts` → `compileMenu`). Ids are full-title-path
 * slugs (`settings-security-sessions`), prefixed with the section at the root,
 * and suffixed with `-2`/`-3`… when two same-titled siblings would collide.
 * Every consumer (expansion maps, active-state maps, React keys) must use
 * `id`, never the title — see the sidebar audit, improvement 7.
 */
/**
 * Recursion anchor for `CompiledSidebarMenuItemSchema` — exported for the
 * same declaration-emit reason as `SidebarMenuItemNode` (cross-module schema
 * references must be nameable in `.d.ts` files).
 */
export interface CompiledSidebarMenuItemNode {
	readonly title: string;
	readonly url: string;
	readonly icon?: string;
	readonly disabled?: boolean;
	readonly id: string;
	readonly children?: readonly CompiledSidebarMenuItemNode[];
}

export const CompiledSidebarMenuItemSchema: z.ZodType<CompiledSidebarMenuItemNode> = z.lazy(() =>
	z.object({
		title: z.string().min(1),
		url: z.string(),
		icon: z.string().optional(),
		disabled: z.boolean().optional(),
		id: z.string().min(1),
		children: z.array(z.lazy(() => CompiledSidebarMenuItemSchema)).optional(),
	}),
);

export type CompiledSidebarMenuItem = z.output<typeof CompiledSidebarMenuItemSchema>;

export const CompiledSidebarMenuSectionSchema = z.object({
	title: z.string().min(1),
	items: z.array(CompiledSidebarMenuItemSchema).readonly(),
});

export type CompiledSidebarMenuSection = z.output<typeof CompiledSidebarMenuSectionSchema>;

/** The menu after `compileMenu` — the shape every component consumes. */
export const CompiledSidebarMenuDataSchema = z.object({
	header: SidebarMenuHeaderSchema,
	sections: z.array(CompiledSidebarMenuSectionSchema).readonly(),
	bottomItems: z.array(CompiledSidebarMenuItemSchema).readonly(),
});

export type CompiledSidebarMenuData = z.output<typeof CompiledSidebarMenuDataSchema>;

/** The signed-in user as shown in the sidebar / topbar / profile dropdown. */
export const SidebarUserSchema = z.object({
	name: z.string().min(1),
	email: z.string(),
});

export type SidebarUser = z.output<typeof SidebarUserSchema>;

/**
 * A custom action rendered in the sidebar footer (e.g. "Report an issue").
 * Carries a component (`LucideIcon`) and a callback — a function contract, so
 * it stays a plain type rather than a zod schema.
 */
export interface FooterAction {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly onClick: () => void;
}
