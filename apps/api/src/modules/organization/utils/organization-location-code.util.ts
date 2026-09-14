import { z } from "zod";

const LocationCodeSchema = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

interface LocationCodeLookupClient {
	organizationLocation: {
		findFirst(args: { where: { organizationId: string; code: string }; select: { id: true } }): Promise<{ id: string } | null>;
	};
}

/** Derive a URL-safe location code from a display name. */
export function slugifyLocationName(displayName: string): string {
	const normalized = displayName
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);

	if (normalized.length >= 1) {
		return LocationCodeSchema.parse(normalized);
	}

	return LocationCodeSchema.parse("store");
}

/** Pick the first unused location code within an organization. */
export async function allocateUniqueLocationCode(tx: LocationCodeLookupClient, organizationId: string, displayName: string): Promise<string> {
	const base = slugifyLocationName(displayName);

	for (let attempt = 0; attempt < 100; attempt += 1) {
		const candidate = attempt === 0 ? base : LocationCodeSchema.parse(`${base}-${String(attempt + 1)}`.slice(0, 64));

		const taken = (await tx.organizationLocation.findFirst({ where: { organizationId, code: candidate }, select: { id: true } })) !== null;

		if (!taken) {
			return candidate;
		}
	}

	throw new Error(`Unable to allocate location code for "${displayName}"`);
}
