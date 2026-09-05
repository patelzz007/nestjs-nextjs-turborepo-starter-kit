import { z } from "zod";

import { PermissionActionSchema, PermissionResourceSchema } from "./enums";

/** Application surface a capability applies to — reusable across template projects. */
export const CapabilityScopeSchema = z.enum(["PLATFORM", "MERCHANT", "ADMIN"]);

export type CapabilityScope = z.output<typeof CapabilityScopeSchema>;

/** Dynamic capability slug validated at API boundaries (catalog lives in `capability_definitions`). */
export const CapabilitySlugSchema = z
	.string()
	.min(1)
	.max(100)
	.regex(/^[a-z0-9]+(?::[a-z0-9_]+)+(\.[a-z0-9_]+)?$/);

export type CapabilitySlug = z.output<typeof CapabilitySlugSchema>;

export const CapabilityDefinitionSchema = z
	.object({
		id: z.string(),
		slug: CapabilitySlugSchema,
		scope: CapabilityScopeSchema,
		label: z.string(),
		description: z.string().nullable(),
		groupName: z.string().nullable(),
		sortOrder: z.number().int(),
		isSystem: z.boolean(),
	})
	.strict();

export type CapabilityDefinition = z.output<typeof CapabilityDefinitionSchema>;

export const CapabilityCatalogQuerySchema = z
	.object({
		scope: CapabilityScopeSchema.optional(),
	})
	.strict();

export type CapabilityCatalogQuery = z.output<typeof CapabilityCatalogQuerySchema>;

export const CapabilityMenuQuerySchema = z
	.object({
		scope: CapabilityScopeSchema,
	})
	.strict();

export type CapabilityMenuQuery = z.output<typeof CapabilityMenuQuerySchema>;

export interface CapabilityMenuItemNode {
	id: string;
	title: string;
	url: string;
	icon: string | null;
	disabled: boolean;
	requiredCapabilities: CapabilitySlug[];
	matchType: z.output<typeof MenuMatchTypeSchema>;
	children: CapabilityMenuItemNode[];
}

const MenuMatchTypeSchema = z.enum(["ANY", "ALL"]);

export const CapabilityMenuItemSchema: z.ZodType<CapabilityMenuItemNode> = z.lazy(() =>
	z
		.object({
			id: z.string(),
			title: z.string(),
			url: z.string(),
			icon: z.string().nullable(),
			disabled: z.boolean(),
			requiredCapabilities: z.array(CapabilitySlugSchema),
			matchType: MenuMatchTypeSchema,
			children: z.array(z.lazy(() => CapabilityMenuItemSchema)),
		})
		.strict(),
);

export type CapabilityMenuItem = z.output<typeof CapabilityMenuItemSchema>;

export const CapabilityMenuSectionSchema = z
	.object({
		title: z.string(),
		color: z.enum(["blue", "green", "amber", "rose", "purple", "teal"]).optional(),
		items: z.array(CapabilityMenuItemSchema),
	})
	.strict();

export type CapabilityMenuSection = z.output<typeof CapabilityMenuSectionSchema>;

export const CapabilityMenuResponseSchema = z
	.object({
		header: z.object({
			title: z.string(),
			subtitle: z.string(),
		}),
		sections: z.array(CapabilityMenuSectionSchema),
	})
	.strict();

export type CapabilityMenuResponse = z.output<typeof CapabilityMenuResponseSchema>;

/** Stable platform slug derived from action × resource (`platform:user.read`). */
export function toPlatformCapabilitySlug(action: z.output<typeof PermissionActionSchema>, resource: z.output<typeof PermissionResourceSchema>): CapabilitySlug {
	const parsed = CapabilitySlugSchema.safeParse(`platform:${resource.toLowerCase()}.${action.toLowerCase()}`);
	if (!parsed.success) {
		return "platform:unknown.read";
	}
	return parsed.data;
}

/** Parses and filters unknown capability strings (e.g. from the database). */
export function parseCapabilitySlugs(values: readonly string[]): CapabilitySlug[] {
	const parsed: CapabilitySlug[] = [];
	for (const value of values) {
		const result = CapabilitySlugSchema.safeParse(value);
		if (result.success) {
			parsed.push(result.data);
		}
	}
	return parsed;
}

/** Returns whether a capability set includes the requested slug. */
export function hasCapability(capabilities: readonly CapabilitySlug[], slug: CapabilitySlug): boolean {
	return capabilities.includes(slug);
}

/** Toggle one capability slug on/off while preserving catalog order. */
export function withCapabilityToggled(catalogOrder: readonly CapabilitySlug[], selected: readonly CapabilitySlug[], slug: CapabilitySlug, enabled: boolean): CapabilitySlug[] {
	const nextSelected = new Set<CapabilitySlug>(selected);
	if (enabled) {
		nextSelected.add(slug);
	} else {
		nextSelected.delete(slug);
	}
	const next: CapabilitySlug[] = [];
	for (const entry of catalogOrder) {
		if (nextSelected.has(entry)) {
			next.push(entry);
		}
	}
	return next;
}

/** Filter menu tree nodes by granted capability slugs. */
export function filterMenuByCapabilities<T extends { readonly requiredCapabilities?: readonly CapabilitySlug[]; readonly children?: readonly T[] }>(
	items: readonly T[],
	capabilities: readonly CapabilitySlug[],
): readonly T[] {
	const filtered: T[] = [];
	for (const item of items) {
		const required = item.requiredCapabilities ?? [];
		const allowed = required.length === 0 || required.some((slug) => hasCapability(capabilities, slug));
		if (!allowed) {
			continue;
		}
		const children = item.children;
		if (children !== undefined && children.length > 0) {
			filtered.push({ ...item, children: filterMenuByCapabilities(children, capabilities) });
			continue;
		}
		filtered.push(item);
	}
	return filtered;
}
