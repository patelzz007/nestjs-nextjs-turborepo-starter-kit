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
