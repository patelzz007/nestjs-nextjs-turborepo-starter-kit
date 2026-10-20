import { TenantSlugSchema } from "@workspace/shared";

/** Derive a URL-safe tenant slug from a display name. */
export function slugifyTenantName(displayName: string): string {
	const normalized = displayName
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);

	if (normalized.length >= 2) {
		return TenantSlugSchema.parse(normalized);
	}

	return TenantSlugSchema.parse("merchant");
}

interface SlugLookupClient {
	tenant: {
		findFirst(args: { where: { slug: string }; select: { id: true } }): Promise<{ id: string } | null>;
	};
	tenantSlugHistory: {
		findFirst(args: { where: { slug: string }; select: { id: true } }): Promise<{ id: string } | null>;
	};
}

/** Pick the first unused slug, appending `-2`, `-3`, … when needed. */
export async function allocateUniqueTenantSlug(tx: SlugLookupClient, displayName: string): Promise<string> {
	const base = slugifyTenantName(displayName);

	for (let attempt = 0; attempt < 100; attempt += 1) {
		const candidate = attempt === 0 ? base : TenantSlugSchema.parse(`${base}-${String(attempt + 1)}`.slice(0, 64));

		const taken =
			(await tx.tenant.findFirst({ where: { slug: candidate }, select: { id: true } })) !== null ||
			(await tx.tenantSlugHistory.findFirst({ where: { slug: candidate }, select: { id: true } })) !== null;

		if (!taken) {
			return candidate;
		}
	}

	throw new Error(`Unable to allocate tenant slug for "${displayName}"`);
}
