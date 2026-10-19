import type { LegalAcceptance } from "../aggregates/legal-acceptance.aggregate";

/** Append-only store of legal acceptances, bound to one unit-of-work transaction. */
export interface LegalAcceptanceRepository {
	add(acceptance: LegalAcceptance): Promise<void>;
}
