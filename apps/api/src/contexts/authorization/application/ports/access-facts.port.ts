// ============================================
// application/ports/access-facts.port.ts — what the decision service reads (ADR 067)
// ============================================
// Dependency Inversion: the application layer owns these interfaces; Prisma
// implements them in infrastructure, and tests implement them in memory.

import type { AccessFacts } from "../../domain/access/access-facts";

/**
 * The caller's standing for one decision.
 *
 * - No `tenantId`: the platform — the user's platform roles and platform grants.
 * - A `tenantId`: the caller's ACTIVE membership there (its role, stores, grants and shares). A platform
 *   user with no membership but an approved, unexpired support grant falls back to their platform
 *   standing; anyone else gets `null`, which the service turns into a denial.
 */
export interface AccessFactsReader {
	read(userId: string, tenantId: string | undefined): Promise<AccessFacts | null>;
}

export const ACCESS_FACTS_READER = Symbol("ACCESS_FACTS_READER");
export const RECORD_OWNERSHIP = Symbol("RECORD_OWNERSHIP");
