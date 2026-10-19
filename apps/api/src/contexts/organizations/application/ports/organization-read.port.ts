import type { OrganizationLogoResponse } from "@workspace/shared";

/** What other contexts show about an organization. */
export interface OrganizationDisplayData {
	readonly organizationId: string;
	readonly slug: string;
	readonly displayName: string;
	/** IANA zone the organization's analytics are cut in. */
	readonly timeZone: string;
	/** The live store logo with its image sources, or `null` (clients show a monogram). */
	readonly logo: OrganizationLogoResponse | null;
}

/**
 * Batched organization reads for other contexts (one query per call, never
 * per id). The caller has already authorized the records that reference
 * these organizations; ids that are not live organizations are absent.
 */
export interface OrganizationReadPort {
	getDisplayData(organizationIds: readonly string[]): Promise<ReadonlyMap<string, OrganizationDisplayData>>;
	/** User ids of the organization's live ACTIVE owners (owner notifications). */
	listOwnerUserIds(organizationId: string): Promise<readonly string[]>;
}
