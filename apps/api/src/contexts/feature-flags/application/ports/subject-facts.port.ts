import type { CustomerTier, PermissionReference } from "@workspace/shared";

/**
 * Facts about a person that rules can read, each supplied by the context that owns it: identity (the email's
 * domain, whether they are platform staff), authorization (their permissions), tiers (their customer tier).
 * Those contexts register a source when they start, so this context imports none of them (tiers already
 * depends on it).
 */
export interface SubjectFactSources {
	emailDomain(userId: string): Promise<string | null>;
	platformStaff(userId: string): Promise<boolean>;
	permissions(userId: string): Promise<readonly PermissionReference[]>;
	customerTier(userId: string): Promise<CustomerTier | null>;
	/**
	 * Whether the person works at that tenant (and, given one, that location of it): a bundle asked for a store
	 * is worked out for it only when this holds, so nobody reads another store's flags by naming it.
	 */
	worksAt(userId: string, tenantId: string, locationId: string | null): Promise<boolean>;
}

export type SubjectFactName = keyof SubjectFactSources;

/** One context's part of the facts. */
export type SubjectFactSource = Partial<SubjectFactSources>;
