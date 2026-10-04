import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ORGANIZATION_SEED_IDS } from "../prisma/seed/organizations";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const MS_PER_DAY = 86_400_000;
/** Owner-requested deletion keeps an organization recoverable this long (`OrganizationLifecycleService`). */
const DELETION_GRACE_DAYS = 30;

/**
 * The review / lifecycle states `pnpm db:seed` leaves behind obey the same invariants the services
 * write them with (`prisma/seed/organization-review-states.ts`, `tenant-policy-revision.ts`,
 * `tenant-encryption.ts`): a reviewed request names its reviewer, a pending-deletion organization
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
			`SELECT r.status, r.reviewed_by_id AS "reviewedById", r.reviewed_at::text AS "reviewedAt", m.id AS "membershipId"
			   FROM public.organization_access_requests r
			   LEFT JOIN public.organization_memberships m
			     ON m.organization_id = r.organization_id AND m.user_id = r.user_id AND m.is_deleted = false
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
			`SELECT rejection_reason AS "rejectionReason", reviewed_by_user_id AS "reviewedByUserId" FROM public.organization_locations WHERE status = 'REJECTED'`,
		);
		expect(rejected.rows.length).toBeGreaterThan(0);
		for (const row of rejected.rows) {
			expect(row.rejectionReason).not.toBeNull();
			expect(row.reviewedByUserId).not.toBeNull();
		}
	});

	it("keeps the deletion grace window on a PENDING_DELETION organization and soft-deletes a DELETED one with its memberships", async () => {
		const pending = await pool.query<{ requestedAt: string; graceEndsAt: string; isDeleted: boolean }>(
			`SELECT e.created_at::text AS "requestedAt", o.deletion_grace_ends_at::text AS "graceEndsAt", o.is_deleted AS "isDeleted"
			   FROM public.organizations o
			   JOIN public.organization_lifecycle_events e ON e.organization_id = o.id AND e.to_state = 'PENDING_DELETION'
			  WHERE o.lifecycle_state = 'PENDING_DELETION'`,
		);
		expect(pending.rows.length).toBeGreaterThan(0);
		for (const row of pending.rows) {
			expect(Number(row.graceEndsAt) - Number(row.requestedAt)).toBe(DELETION_GRACE_DAYS * MS_PER_DAY);
			expect(row.isDeleted).toBe(false);
		}

		const deleted = await pool.query<{ isDeleted: boolean; deletedAt: string | null; liveMemberships: string; graceEndsAt: string }>(
			`SELECT o.is_deleted AS "isDeleted", o.deleted_at::text AS "deletedAt", o.deletion_grace_ends_at::text AS "graceEndsAt",
			        (SELECT count(*) FROM public.organization_memberships m WHERE m.organization_id = o.id AND m.is_deleted = false)::text AS "liveMemberships"
			   FROM public.organizations o
			  WHERE o.lifecycle_state = 'DELETED'`,
		);
		expect(deleted.rows.length).toBeGreaterThan(0);
		for (const row of deleted.rows) {
			expect(row.isDeleted).toBe(true);
			expect(Number(row.deletedAt)).toBeGreaterThanOrEqual(Number(row.graceEndsAt));
			expect(row.liveMemberships).toBe("0");
		}
	});

	it("keeps both demo merchants ACTIVE next to the organizations of the deletion flow", async () => {
		const active = await pool.query<{ id: string }>("SELECT id FROM public.organizations WHERE lifecycle_state = 'ACTIVE' AND is_deleted = false");
		const ids = active.rows.map((row) => row.id);
		expect(ids).toContain(ORGANIZATION_SEED_IDS.klOrganization);
		expect(ids).toContain(ORGANIZATION_SEED_IDS.mlkOrganization);
	});

	it("has exactly one live version per policy slot, and a four-eyes revision that supersedes version 1 and carries its SQL predicate", async () => {
		const slots = await pool.query<{ live: string }>(
			`SELECT count(*) FILTER (WHERE superseded_at IS NULL)::text AS live
			   FROM public.authorization_policy_versions WHERE organization_id IS NOT NULL GROUP BY organization_id`,
		);
		for (const slot of slots.rows) {
			expect(slot.live).toBe("1");
		}
		const revised = await pool.query<{ version: number; sqlPredicate: string | null; supersededAt: string | null; approvedById: string | null }>(
			`SELECT v.version, v.sql_predicate AS "sqlPredicate", v.superseded_at::text AS "supersededAt", d.approved_by_id AS "approvedById"
			   FROM public.authorization_policy_versions v JOIN public.authorization_policy_drafts d ON d.id = v.draft_id
			  WHERE v.organization_id = $1 AND v.scope = 'TENANT' ORDER BY v.version`,
			[ORGANIZATION_SEED_IDS.mlkOrganization],
		);
		expect(revised.rows.map((row) => row.version)).toEqual([1, 2]);
		expect(revised.rows[0]?.supersededAt).not.toBeNull();
		expect(revised.rows[1]?.supersededAt).toBeNull();
		expect(revised.rows[1]?.sqlPredicate).toContain(ORGANIZATION_SEED_IDS.mlkOrganization);
		expect(revised.rows[1]?.approvedById).not.toBeNull();
	});

	it("stamps and audits a re-wrapped tenant data key", async () => {
		const rotated = await pool.query<{ id: string; kmsKeyId: string; audits: string }>(
			`SELECT k.id, k.kms_key_id AS "kmsKeyId",
			        (SELECT count(*) FROM public.organization_audit_logs a
			          WHERE a.resource_id = k.id::text AND a.action = 'encryption.tenant_key.rewrapped' AND a.metadata ->> 'fromKmsKeyId' = 'local:pilot')::text AS audits
			   FROM public.tenant_encryption_keys k WHERE k.rotated_at IS NOT NULL`,
		);
		expect(rotated.rows.length).toBeGreaterThan(0);
		for (const row of rotated.rows) {
			expect(row.kmsKeyId).not.toBe("local:pilot");
			expect(row.audits).toBe("1");
		}
	});

	it("records kernel decision audits with the full request context", async () => {
		const row = await pool.query<{ ipAddress: string | null; userAgent: string | null; requestId: string | null; durationMs: number | null }>(
			`SELECT ip_address AS "ipAddress", user_agent AS "userAgent", request_id AS "requestId", duration_ms AS "durationMs" FROM public.authorization_audits WHERE location_id IS NOT NULL`,
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
