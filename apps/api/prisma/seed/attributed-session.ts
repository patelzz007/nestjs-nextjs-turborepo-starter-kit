import type { Prisma } from "@prisma/client";

import type { SystemOperation } from "../../src/prisma/system-operation.registry";
import { prisma } from "./client";

// ---------------------------------------------------------------------------
// Seed writes that stand for a seeded API request.
//
// The data-change capture triggers (ADR 051) attribute every row change to the
// database session it ran in: the API stamps the actor, tenant, API key,
// system operation, purpose and correlation id on every transaction
// (TenantTransactionService, prisma/rls-pool.ts). Seed writes run as the seed
// login with none of that, so they are recorded as UNATTRIBUTED — which is the
// truth for bulk fixture data. A seed write that reproduces what a seeded
// `AuditLog` request did runs through `withSeedAttribution` instead, under
// the SAME session variables that request would have set, so its change
// record joins the request by correlation id exactly like a live one.
// ---------------------------------------------------------------------------

/** The session a seeded request's writes ran under; `null` = the request had none of it. */
export interface SeedSessionAttribution {
	/** The seeded `AuditLog` row's correlation id (`seedAuditCorrelationId`). */
	readonly correlationId: string;
	readonly actorUserId: string | null;
	readonly organizationId: string | null;
	readonly apiKeyId: string | null;
	readonly systemOperation: SystemOperation | null;
	/** `app.actor_purpose`: the system operation's reason, as the API passes it. */
	readonly actorPurpose: string | null;
}

/** SQL has no "absent" for a setting; the capture trigger reads `''` as NULL. */
const UNSET = "";

/** Runs `work` in one transaction stamped with `attribution` (transaction-local, like the API). */
export async function withSeedAttribution<T>(attribution: SeedSessionAttribution, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
	return prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<T> => {
		await tx.$executeRaw`SELECT set_config('app.correlation_id', ${attribution.correlationId}, true),
			set_config('app.current_user_id', ${attribution.actorUserId ?? UNSET}, true),
			set_config('app.current_organization_id', ${attribution.organizationId ?? UNSET}, true),
			set_config('app.current_api_key_id', ${attribution.apiKeyId ?? UNSET}, true),
			set_config('app.system_operation', ${attribution.systemOperation ?? UNSET}, true),
			set_config('app.actor_purpose', ${attribution.actorPurpose ?? UNSET}, true)`;
		return work(tx);
	});
}
