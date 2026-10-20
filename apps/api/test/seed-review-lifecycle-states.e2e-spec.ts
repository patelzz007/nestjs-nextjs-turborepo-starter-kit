import { Pool } from "pg";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TENANT_SEED_IDS } from "../prisma/seed/tenants";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const MS_PER_DAY = 86_400_000;
/** Owner-requested deletion keeps a tenant recoverable this long (`TenantLifecycleService`). */
const DELETION_GRACE_DAYS = 30;

/**
 * The review / lifecycle states `pnpm db:seed` leaves behind obey the same invariants the services
 * write them with (`prisma/seed/tenant-review-states.ts`, `tenant-policy-revision.ts`,
 * `tenant-encryption.ts`): a reviewed request names its reviewer, a pending-deletion tenant
 * carries its grace deadline, a superseded policy version has exactly one live successor, and a
 * re-wrapped data key is stamped and audited.
 */
describe("Seeded review and lifecycle states (integration)", () => {
	let pool: Pool;

	beforeAll(() => {
		pool = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		await pool.end();
	});

	it("names the reviewer and review time of every reviewed access request, and creates the membership of an approved one", async () => {
		const reviewed = await pool.query<{ status: string; reviewedById: string | null; reviewedAt: string | null; membershipId: string | null }>(
			`SELECT r.status, r."reviewedById" AS "reviewedById", r."reviewedAt"::text AS "reviewedAt", m.id AS "membershipId"
			   FROM public."TenantAccessRequest" r
			   LEFT JOIN public."Membership" m
			     ON m."tenantId" = r."tenantId" AND m."userId" = r."userId" AND m."isDeleted" = false
			  WHERE r.status <> 'PENDING'`,
		);
		expect(reviewed.rows.map((row) => row.status).sort()).toEqual(["APPROVED", "REJECTED"]);
		for (const row of reviewed.rows) {
			expect(row.reviewedById).not.toBeNull();
			expect(row.reviewedAt).not.toBeNull();
			expect(row.membershipId !== null).toBe(row.status === "APPROVED");
		}
	});

	it("gives every rejected store request a reason and a reviewer", async () => {
		const rejected = await pool.query<{ rejectionReason: string | null; reviewedByUserId: string | null }>(
			`SELECT "rejectionReason" AS "rejectionReason", "reviewedByUserId" AS "reviewedByUserId" FROM public."Location" WHERE status = 'REJECTED'`,
		);
		expect(rejected.rows.length).toBeGreaterThan(0);
		for (const row of rejected.rows) {
			expect(row.rejectionReason).not.toBeNull();
			expect(row.reviewedByUserId).not.toBeNull();
		}
	});

	it("keeps the deletion grace window on a PENDING_DELETION tenant and soft-deletes a DELETED one with its memberships", async () => {
		const pending = await pool.query<{ requestedAt: string; graceEndsAt: string; isDeleted: boolean }>(
			`SELECT e."createdAt"::text AS "requestedAt", o."deletionGraceEndsAt"::text AS "graceEndsAt", o."isDeleted" AS "isDeleted"
			   FROM public."Tenant" o
			   JOIN public."TenantLifecycleEvent" e ON e."tenantId" = o.id AND e."toState" = 'PENDING_DELETION'
			  WHERE o."lifecycleState" = 'PENDING_DELETION'`,
		);
		expect(pending.rows.length).toBeGreaterThan(0);
		for (const row of pending.rows) {
			expect(Number(row.graceEndsAt) - Number(row.requestedAt)).toBe(DELETION_GRACE_DAYS * MS_PER_DAY);
			expect(row.isDeleted).toBe(false);
		}

		const deleted = await pool.query<{ isDeleted: boolean; deletedAt: string | null; liveMemberships: string; graceEndsAt: string }>(
			`SELECT o."isDeleted" AS "isDeleted", o."deletedAt"::text AS "deletedAt", o."deletionGraceEndsAt"::text AS "graceEndsAt",
			        (SELECT count(*) FROM public."Membership" m WHERE m."tenantId" = o.id AND m."isDeleted" = false)::text AS "liveMemberships"
			   FROM public."Tenant" o
			  WHERE o."lifecycleState" = 'DELETED'`,
		);
		expect(deleted.rows.length).toBeGreaterThan(0);
		for (const row of deleted.rows) {
			expect(row.isDeleted).toBe(true);
			expect(Number(row.deletedAt)).toBeGreaterThanOrEqual(Number(row.graceEndsAt));
			expect(row.liveMemberships).toBe("0");
		}
	});

	it("keeps both demo merchants ACTIVE next to the tenants of the deletion flow", async () => {
		const active = await pool.query<{ id: string }>('SELECT id FROM public."Tenant" WHERE "lifecycleState" = \'ACTIVE\' AND "isDeleted" = false');
		const ids = active.rows.map((row) => row.id);
		expect(ids).toContain(TENANT_SEED_IDS.klTenant);
		expect(ids).toContain(TENANT_SEED_IDS.mlkTenant);
	});

	it("has exactly one live version per policy slot, and a four-eyes revision that supersedes version 1 and carries its SQL predicate", async () => {
		const slots = await pool.query<{ live: string }>(
			`SELECT count(*) FILTER (WHERE "supersededAt" IS NULL)::text AS live
			   FROM public."AuthorizationPolicyVersion" WHERE "tenantId" IS NOT NULL GROUP BY "tenantId"`,
		);
		for (const slot of slots.rows) {
			expect(slot.live).toBe("1");
		}
		const revised = await pool.query<{ version: number; sqlPredicate: string | null; supersededAt: string | null; approvedById: string | null }>(
			`SELECT v.version, v."sqlPredicate" AS "sqlPredicate", v."supersededAt"::text AS "supersededAt", d."approvedById" AS "approvedById"
			   FROM public."AuthorizationPolicyVersion" v JOIN public."AuthorizationPolicyDraft" d ON d.id = v."draftId"
			  WHERE v."tenantId" = $1 AND v.scope = 'TENANT' ORDER BY v.version`,
			[TENANT_SEED_IDS.mlkTenant],
		);
		expect(revised.rows.map((row) => row.version)).toEqual([1, 2]);
		expect(revised.rows[LIST_SLOT_INDEX.first]?.supersededAt).not.toBeNull();
		expect(revised.rows[LIST_SLOT_INDEX.second]?.supersededAt).toBeNull();
		expect(revised.rows[LIST_SLOT_INDEX.second]?.sqlPredicate).toContain(TENANT_SEED_IDS.mlkTenant);
		expect(revised.rows[LIST_SLOT_INDEX.second]?.approvedById).not.toBeNull();
	});

	it("stamps and audits a re-wrapped tenant data key", async () => {
		const rotated = await pool.query<{ id: string; kmsKeyId: string; audits: string }>(
			`SELECT k.id, k."kmsKeyId" AS "kmsKeyId",
			        (SELECT count(*) FROM public."TenantAuditLog" a
			          WHERE a."resourceId" = k.id::text AND a.action = 'encryption.tenant_key.rewrapped' AND a.metadata ->> 'fromKmsKeyId' = 'local:pilot')::text AS audits
			   FROM public."TenantEncryptionKey" k WHERE k."rotatedAt" IS NOT NULL`,
		);
		expect(rotated.rows.length).toBeGreaterThan(0);
		for (const row of rotated.rows) {
			expect(row.kmsKeyId).not.toBe("local:pilot");
			expect(row.audits).toBe("1");
		}
	});

	it("records kernel decision audits with the full request context", async () => {
		const row = await pool.query<{ ipAddress: string | null; userAgent: string | null; requestId: string | null; durationMs: number | null }>(
			`SELECT "ipAddress" AS "ipAddress", "userAgent" AS "userAgent", "requestId" AS "requestId", "durationMs" AS "durationMs" FROM public."AuthorizationAudit" WHERE "locationId" IS NOT NULL`,
		);
		expect(row.rows.length).toBeGreaterThan(0);
		for (const audit of row.rows) {
			expect(audit.ipAddress).not.toBeNull();
			expect(audit.userAgent).not.toBeNull();
			expect(audit.requestId).not.toBeNull();
			expect(audit.durationMs).not.toBeNull();
		}
	});
});
