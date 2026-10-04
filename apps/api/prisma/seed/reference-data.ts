import type { Permission, Role } from "@prisma/client";

import { createReferenceDataSyncService } from "../../src/modules/authorization/reference-data/reference-data.composition";
import { formatReferenceDataReport } from "../../src/modules/authorization/reference-data/sync-reference-data.command";
import { seedAbacConditions } from "./abac";
import { prisma } from "./client";
import { seedLog } from "./seed-log";

export interface ReferenceData {
	readonly permissions: Permission[];
	readonly roles: Role[];
}

/**
 * Reference data every scenario needs before the API can authorize anything. The platform part —
 * permission catalog, system roles and their grants, merchant capability catalog — is loaded by the
 * SAME loader as the production command `db:sync-reference-data` (one source of truth, so the seed and
 * a real deployment cannot drift). Only the ABAC DEMO condition is seed-only. Re-running writes nothing.
 */
export async function seedReferenceData(): Promise<ReferenceData> {
	seedLog("Syncing reference data (same loader as db:sync-reference-data)...");
	seedLog(formatReferenceDataReport(await createReferenceDataSyncService((handler) => prisma.$transaction(handler)).sync()));

	const permissions: Permission[] = await prisma.permission.findMany();
	const roles: Role[] = await prisma.role.findMany();

	seedLog("Seeding ABAC demo conditions...");
	await seedAbacConditions(permissions);
	seedLog("✅ ABAC conditions seeded on MANAGE:SYSTEM_SETTINGS");

	return { permissions, roles };
}
