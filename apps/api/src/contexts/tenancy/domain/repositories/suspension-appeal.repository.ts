import type { SuspensionAppeal } from "../aggregates/suspension-appeal.aggregate";

/** Persistence port of the {@link SuspensionAppeal} aggregate (bound to one unit of work). */
export interface SuspensionAppealRepository {
	nextId(): string;
	/** Inserts a PENDING appeal. A second pending appeal of the tenant throws `TenantAppealPendingError`. */
	add(appeal: SuspensionAppeal): Promise<void>;
	/** The tenant's PENDING appeal under its row lock, or `null`. */
	findPendingForUpdate(tenantId: string): Promise<SuspensionAppeal | null>;
	/** One appeal of the tenant under its row lock, or `null`. */
	findForUpdate(tenantId: string, appealId: string): Promise<SuspensionAppeal | null>;
	/** Writes the review: compare-and-set on the appeal still being PENDING (`TenantAppealNotPendingError` when it is not). */
	save(appeal: SuspensionAppeal): Promise<void>;
}
