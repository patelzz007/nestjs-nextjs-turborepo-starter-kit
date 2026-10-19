import type { PilotCity } from "@workspace/shared";

import type { Organization } from "../aggregates/organization.aggregate";

/** Persistence port of the {@link Organization} aggregate (bound to one unit of work). */
export interface OrganizationRepository {
	nextId(): string;
	/** The first free slug derived from `displayName` (`name`, `name-2`, …), checked against live slugs and slug history. */
	allocateSlug(displayName: string): Promise<string>;
	/** Inserts the organization with its merchant profile, placement and lifecycle events. A taken slug throws `OrganizationSlugTakenError`. */
	add(organization: Organization): Promise<void>;
	/** A live organization. */
	findById(organizationId: string): Promise<Organization | null>;
	/** The pilot city on the live organization's merchant profile; `null` when it has no merchant profile. */
	findMerchantCity(organizationId: string): Promise<PilotCity | null>;
	/** Writes the lifecycle change (compare-and-set on the loaded state), rename and lifecycle events. */
	save(organization: Organization): Promise<void>;
}
