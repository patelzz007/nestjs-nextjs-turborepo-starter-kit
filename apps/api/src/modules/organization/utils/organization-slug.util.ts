import { OrganizationSlugSchema } from "@workspace/shared";

/** Derive a URL-safe organization slug from a display name. */
export function slugifyOrganizationName(displayName: string): string {
	const normalized = displayName
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);

	if (normalized.length >= 2) {
		return OrganizationSlugSchema.parse(normalized);
	}

	return OrganizationSlugSchema.parse("merchant");
}

type SlugLookupClient = {
	organization: {
		findFirst(args: { where: { slug: string }; select: { id: true } }): Promise<{ id: string } | null>;
	};
	organizationSlugHistory: {
		findFirst(args: { where: { slug: string }; select: { id: true } }): Promise<{ id: string } | null>;
	};
};

/** Pick the first unused slug, appending `-2`, `-3`, … when needed. */
export async function allocateUniqueOrganizationSlug(tx: SlugLookupClient, displayName: string): Promise<string> {
	const base = slugifyOrganizationName(displayName);

	for (let attempt = 0; attempt < 100; attempt += 1) {
		const candidate =
			attempt === 0
				? base
				: OrganizationSlugSchema.parse(`${base}-${String(attempt + 1)}`.slice(0, 64));

		const taken =
			(await tx.organization.findFirst({ where: { slug: candidate }, select: { id: true } })) !== null ||
			(await tx.organizationSlugHistory.findFirst({ where: { slug: candidate }, select: { id: true } })) !== null;

		if (!taken) {
			return candidate;
		}
	}

	throw new Error(`Unable to allocate organization slug for "${displayName}"`);
}
