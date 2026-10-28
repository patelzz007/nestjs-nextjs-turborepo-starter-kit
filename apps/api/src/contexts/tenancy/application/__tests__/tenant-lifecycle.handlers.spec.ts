import { epochMs, TenantLifecycleStateSchema, type TenantLifecycleResponse } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { Membership, type MembershipState } from "../../domain/aggregates/membership.aggregate";
import { SuspensionAppeal } from "../../domain/aggregates/suspension-appeal.aggregate";
import { Tenant, type TenantState } from "../../domain/aggregates/tenant.aggregate";
import { TenantAppealPendingError, TenantLifecycleTransitionError, TenantOwnerCannotLeaveError, TenantOwnerRequiredError } from "../../domain/errors/tenants.errors";
import type { MembershipRepository, PersistedMembership } from "../../domain/repositories/membership.repository";
import type { SuspensionAppealRepository } from "../../domain/repositories/suspension-appeal.repository";
import type { TenantRepository } from "../../domain/repositories/tenant.repository";
import { LeaveTenantCommand } from "../commands/leave-tenant/leave-tenant.command";
import { LeaveTenantHandler } from "../commands/leave-tenant/leave-tenant.handler";
import { ReactivateTenantCommand } from "../commands/reactivate-tenant/reactivate-tenant.command";
import { ReactivateTenantHandler } from "../commands/reactivate-tenant/reactivate-tenant.handler";
import { ReinstateTenantCommand } from "../commands/reinstate-tenant/reinstate-tenant.command";
import { ReinstateTenantHandler } from "../commands/reinstate-tenant/reinstate-tenant.handler";
import { RejectSuspensionAppealCommand } from "../commands/reject-suspension-appeal/reject-suspension-appeal.command";
import { RejectSuspensionAppealHandler } from "../commands/reject-suspension-appeal/reject-suspension-appeal.handler";
import { SuspendTenantCommand } from "../commands/suspend-tenant/suspend-tenant.command";
import { SuspendTenantHandler } from "../commands/suspend-tenant/suspend-tenant.handler";
import { BanTenantCommand } from "../commands/ban-tenant/ban-tenant.command";
import { APPEAL_CLOSED_BY_BAN_NOTE, BanTenantHandler } from "../commands/ban-tenant/ban-tenant.handler";
import { UnbanTenantCommand } from "../commands/unban-tenant/unban-tenant.command";
import { UnbanTenantHandler } from "../commands/unban-tenant/unban-tenant.handler";
import type { TenantAuditEntry } from "../ports/tenant-audit.port";
import type { TenantLifecycleReadPort } from "../ports/tenant-lifecycle-read.port";
import type { TenantsScope } from "../tenants-scope";

const TENANT_ID = "0199a1b2-0000-7000-8000-000000000001";
const ADMIN_ID = "0199a1b2-0000-7000-8000-000000000009";
const OWNER_ID = "0199a1b2-0000-7000-8000-000000000002";
const CASHIER_ID = "0199a1b2-0000-7000-8000-000000000003";
const NOW = epochMs(1_792_368_000_000);
const CLOCK: Clock = { now: () => NOW };

function userActor(userId: string): ActorContext {
	return {
		kind: "user",
		userId,
		sessionId: "session-1",
		tenantId: null,
		isSuperAdmin: userId === ADMIN_ID,
		accessScope: "tenant",
		impersonatorUserId: null,
		request: { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
	};
}

type LifecycleScope = Pick<TenantsScope, "tenants" | "appeals" | "memberships" | "audit" | "events">;

/** One tenant, its memberships and appeals as stored rows; a throwing unit of work leaves them untouched. */
class LifecycleStore implements UnitOfWork<LifecycleScope> {
	public tenant: TenantState = { id: TENANT_ID, slug: "brew", displayName: "Brew", lifecycleState: "ACTIVE", deletionGraceEndsAt: null };
	public readonly memberships = new Map<string, MembershipState & { readonly isDeleted: boolean }>();
	public readonly appeals = new Map<string, { readonly id: string; readonly status: string; readonly message: string; readonly reviewNote: string | null }>();
	public readonly audit: TenantAuditEntry[] = [];
	private nextAppeal = 0;

	public run<TResult>(_actor: ActorContext, work: (scope: LifecycleScope) => Promise<TResult>): Promise<TResult> {
		return this.transaction(work);
	}

	public runSystemOperation<TResult>(_operation: string, _actor: ActorContext, work: (scope: LifecycleScope) => Promise<TResult>): Promise<TResult> {
		return this.transaction(work);
	}

	private async transaction<TResult>(work: (scope: LifecycleScope) => Promise<TResult>): Promise<TResult> {
		const snapshot = { tenant: this.tenant, memberships: new Map(this.memberships), appeals: new Map(this.appeals), audit: this.audit.length };
		try {
			return await work(this.scope());
		} catch (error) {
			this.tenant = snapshot.tenant;
			this.memberships.clear();
			snapshot.memberships.forEach((value, key) => this.memberships.set(key, value));
			this.appeals.clear();
			snapshot.appeals.forEach((value, key) => this.appeals.set(key, value));
			this.audit.length = snapshot.audit;
			throw error;
		}
	}

	private scope(): LifecycleScope {
		const tenants: TenantRepository = {
			nextId: () => TENANT_ID,
			allocateSlug: () => Promise.resolve("brew"),
			add: () => Promise.reject(new Error("not used")),
			findById: (tenantId) => Promise.resolve(tenantId === this.tenant.id ? Tenant.rehydrate(this.tenant) : null),
			findByRouteKey: (routeKey) => Promise.resolve(routeKey === this.tenant.slug ? Tenant.rehydrate(this.tenant) : null),
			findMerchantCity: () => Promise.resolve(null),
			save: (tenant) => {
				this.tenant = { ...this.tenant, lifecycleState: tenant.lifecycleState, deletionGraceEndsAt: tenant.deletionGraceEndsAt };
				return Promise.resolve();
			},
		};
		const appeals: SuspensionAppealRepository = {
			nextId: () => `appeal-${String((this.nextAppeal += 1))}`,
			add: (appeal) => {
				if ([...this.appeals.values()].some((row) => row.status === "PENDING")) {
					return Promise.reject(new TenantAppealPendingError());
				}
				this.appeals.set(appeal.id, { id: appeal.id, status: "PENDING", message: appeal.message, reviewNote: null });
				return Promise.resolve();
			},
			findPendingForUpdate: () => Promise.resolve(this.loadAppeal([...this.appeals.values()].find((row) => row.status === "PENDING")?.id)),
			findForUpdate: (_tenantId, appealId) => Promise.resolve(this.loadAppeal(appealId)),
			save: (appeal) => {
				const review = appeal.review;
				const row = this.appeals.get(appeal.id);
				if (review !== null && row !== undefined) {
					this.appeals.set(appeal.id, { ...row, status: review.status, reviewNote: review.reviewNote });
				}
				return Promise.resolve();
			},
		};
		const ownLive = (userId: string): Membership | null => {
			const row = [...this.memberships.values()].find((candidate) => candidate.userId === userId && !candidate.isDeleted);
			return row === undefined ? null : Membership.rehydrate(row);
		};
		const memberships: MembershipRepository = {
			nextId: () => "m-new",
			existsLive: () => Promise.resolve(false),
			getLiveForUpdate: () => Promise.resolve(null),
			getOwnLiveForUpdate: (_tenantId, userId) => Promise.resolve(ownLive(userId)),
			getOwnActiveForUpdate: (_tenantId, userId) => {
				const live = ownLive(userId);
				return Promise.resolve(live?.status === "ACTIVE" ? live : null);
			},
			add: () => Promise.reject(new Error("not used")),
			save: (membership): Promise<PersistedMembership> => {
				const row = this.memberships.get(membership.id);
				if (row === undefined) {
					return Promise.reject(new Error("unknown membership"));
				}
				const left = membership.changes.some((change) => change.kind === "left");
				this.memberships.set(membership.id, { ...row, isDeleted: left });
				return Promise.resolve({ ...row, createdAt: NOW, updatedAt: NOW });
			},
		};
		return {
			tenants,
			appeals,
			memberships,
			audit: {
				record: (entry: TenantAuditEntry): Promise<void> => {
					this.audit.push(entry);
					return Promise.resolve();
				},
			},
			events: new TransactionalEventCollector(),
		};
	}

	private loadAppeal(appealId: string | undefined): SuspensionAppeal | null {
		const row = appealId === undefined ? undefined : this.appeals.get(appealId);
		return row === undefined ? null : SuspensionAppeal.rehydrate({ ...row, tenantId: TENANT_ID, submittedByUserId: OWNER_ID, reviewedByUserId: null, reviewedAt: null });
	}
}

/** The lifecycle view straight from the store. */
class StoreLifecycleReads implements TenantLifecycleReadPort {
	public constructor(private readonly store: LifecycleStore) {}

	public findMemberTenantId(): Promise<string | null> {
		return Promise.resolve(TENANT_ID);
	}

	public findLifecycle(): Promise<TenantLifecycleResponse | null> {
		return Promise.resolve({
			tenantId: TENANT_ID,
			lifecycleState: TenantLifecycleStateSchema.parse(this.store.tenant.lifecycleState),
			deletionGraceEndsAt: null,
			suspension: null,
			ban: null,
			appeals: [],
		});
	}
}

let store: LifecycleStore;
let reads: StoreLifecycleReads;

function member(id: string, userId: string, role: string, status = "ACTIVE"): void {
	store.memberships.set(id, {
		id,
		tenantId: TENANT_ID,
		userId,
		role,
		status,
		displayName: null,
		scopeRows: [{ scopeType: "ALL_LOCATIONS", locationId: null }],
		isDeleted: false,
	});
}

beforeEach(() => {
	store = new LifecycleStore();
	reads = new StoreLifecycleReads(store);
	member("m-owner", OWNER_ID, "OWNER");
	member("m-cashier", CASHIER_ID, "CASHIER", "SUSPENDED");
});

describe("platform admin lifecycle commands", () => {
	it("suspends an active tenant with an audit row, and refuses a second suspension", async () => {
		await expect(
			new SuspendTenantHandler(store, reads, CLOCK).execute(new SuspendTenantCommand(userActor(ADMIN_ID), { tenantId: TENANT_ID, reason: "Fraud review" })),
		).resolves.toMatchObject({
			lifecycleState: "SUSPENDED",
		});
		expect(store.audit).toEqual([
			expect.objectContaining({ action: "tenant.suspended", actorUserId: ADMIN_ID, metadata: { from: "ACTIVE", to: "SUSPENDED", reason: "Fraud review" } }),
		]);

		await expect(
			new SuspendTenantHandler(store, reads, CLOCK).execute(new SuspendTenantCommand(userActor(ADMIN_ID), { tenantId: TENANT_ID, reason: "Again" })),
		).rejects.toBeInstanceOf(TenantLifecycleTransitionError);
		expect(store.audit).toHaveLength(1);
	});

	it("reinstates a suspended tenant and accepts its pending appeal with the admin's reason", async () => {
		store.tenant = { ...store.tenant, lifecycleState: "SUSPENDED" };
		store.appeals.set("appeal-1", { id: "appeal-1", status: "PENDING", message: "Please", reviewNote: null });

		await new ReinstateTenantHandler(store, reads, CLOCK).execute(new ReinstateTenantCommand(userActor(ADMIN_ID), { tenantId: TENANT_ID, reason: "Documents verified" }));

		expect(store.tenant.lifecycleState).toBe("ACTIVE");
		expect(store.appeals.get("appeal-1")).toMatchObject({ status: "ACCEPTED", reviewNote: "Documents verified" });
		expect(store.audit.at(-1)).toMatchObject({ action: "tenant.reinstated", metadata: { acceptedAppealId: "appeal-1" } });
	});

	it("rejects a pending appeal; the tenant stays suspended", async () => {
		store.tenant = { ...store.tenant, lifecycleState: "SUSPENDED" };
		store.appeals.set("appeal-1", { id: "appeal-1", status: "PENDING", message: "Please", reviewNote: null });

		await new RejectSuspensionAppealHandler(store, reads, CLOCK).execute(
			new RejectSuspensionAppealCommand(userActor(ADMIN_ID), { tenantId: TENANT_ID, appealId: "appeal-1", note: "Chargebacks continue" }),
		);

		expect(store.appeals.get("appeal-1")).toMatchObject({ status: "REJECTED", reviewNote: "Chargebacks continue" });
		expect(store.tenant.lifecycleState).toBe("SUSPENDED");
	});
});

describe("super admin ban commands", () => {
	it("bans an active tenant with an audit row, and refuses a second ban", async () => {
		await expect(
			new BanTenantHandler(store, reads, CLOCK).execute(new BanTenantCommand(userActor(ADMIN_ID), { tenantId: TENANT_ID, reason: "  Counterfeit vouchers  " })),
		).resolves.toMatchObject({ lifecycleState: "BANNED" });
		expect(store.audit).toEqual([
			expect.objectContaining({
				action: "tenant.banned",
				actorUserId: ADMIN_ID,
				metadata: { from: "ACTIVE", to: "BANNED", reason: "Counterfeit vouchers", closedAppealId: null },
			}),
		]);

		await expect(
			new BanTenantHandler(store, reads, CLOCK).execute(new BanTenantCommand(userActor(ADMIN_ID), { tenantId: TENANT_ID, reason: "Again" })),
		).rejects.toBeInstanceOf(TenantLifecycleTransitionError);
		expect(store.audit).toHaveLength(1);
	});

	it("bans a suspended tenant and closes its pending appeal, since a banned tenant cannot appeal", async () => {
		store.tenant = { ...store.tenant, lifecycleState: "SUSPENDED" };
		store.appeals.set("appeal-1", { id: "appeal-1", status: "PENDING", message: "Please", reviewNote: null });

		await new BanTenantHandler(store, reads, CLOCK).execute(new BanTenantCommand(userActor(ADMIN_ID), { tenantId: TENANT_ID, reason: "Fraud confirmed" }));

		expect(store.tenant.lifecycleState).toBe("BANNED");
		expect(store.appeals.get("appeal-1")).toMatchObject({ status: "REJECTED", reviewNote: APPEAL_CLOSED_BY_BAN_NOTE });
		expect(store.audit.at(-1)).toMatchObject({ action: "tenant.banned", metadata: { from: "SUSPENDED", closedAppealId: "appeal-1" } });
	});

	it("refuses to ban a tenant pending deletion, and leaves it untouched", async () => {
		store.tenant = { ...store.tenant, lifecycleState: "PENDING_DELETION" };

		await expect(
			new BanTenantHandler(store, reads, CLOCK).execute(new BanTenantCommand(userActor(ADMIN_ID), { tenantId: TENANT_ID, reason: "Fraud" })),
		).rejects.toBeInstanceOf(TenantLifecycleTransitionError);
		expect(store.tenant.lifecycleState).toBe("PENDING_DELETION");
		expect(store.audit).toEqual([]);
	});

	it("lifts a ban: the tenant is active again, audited; a tenant that is not banned is refused", async () => {
		await expect(
			new UnbanTenantHandler(store, reads, CLOCK).execute(new UnbanTenantCommand(userActor(ADMIN_ID), { tenantId: TENANT_ID, reason: "Not banned" })),
		).rejects.toBeInstanceOf(TenantLifecycleTransitionError);

		store.tenant = { ...store.tenant, lifecycleState: "BANNED" };
		await expect(
			new UnbanTenantHandler(store, reads, CLOCK).execute(new UnbanTenantCommand(userActor(ADMIN_ID), { tenantId: TENANT_ID, reason: "Appeal upheld by legal" })),
		).resolves.toMatchObject({ lifecycleState: "ACTIVE" });
		expect(store.audit).toEqual([expect.objectContaining({ action: "tenant.unbanned", metadata: { from: "BANNED", to: "ACTIVE", reason: "Appeal upheld by legal" } })]);
	});
});

describe("tenant-side lifecycle commands", () => {
	it("reactivates a tenant pending deletion for its owner only", async () => {
		store.tenant = { ...store.tenant, lifecycleState: "PENDING_DELETION", deletionGraceEndsAt: epochMs(NOW + 1) };
		member("m-manager", "manager-member", "MANAGER");

		await expect(
			new ReactivateTenantHandler(store, reads, CLOCK).execute(new ReactivateTenantCommand(userActor("manager-member"), { tenantSlug: "brew" })),
		).rejects.toBeInstanceOf(TenantOwnerRequiredError);
		await new ReactivateTenantHandler(store, reads, CLOCK).execute(new ReactivateTenantCommand(userActor(OWNER_ID), { tenantSlug: "brew" }));

		expect(store.tenant).toMatchObject({ lifecycleState: "ACTIVE", deletionGraceEndsAt: null });
		expect(store.audit.at(-1)).toMatchObject({ action: "tenant.reactivated", actorUserId: OWNER_ID });
	});

	it("lets a suspended member leave, audited, and refuses the owner", async () => {
		await expect(new LeaveTenantHandler(store, CLOCK).execute(new LeaveTenantCommand(userActor(CASHIER_ID), { tenantSlug: "brew" }))).resolves.toEqual({
			tenantId: TENANT_ID,
			membershipId: "m-cashier",
			leftAt: NOW,
		});
		expect(store.memberships.get("m-cashier")?.isDeleted).toBe(true);
		expect(store.audit.at(-1)).toMatchObject({ action: "membership.left", metadata: { role: "CASHIER", status: "SUSPENDED" } });

		await expect(new LeaveTenantHandler(store, CLOCK).execute(new LeaveTenantCommand(userActor(OWNER_ID), { tenantSlug: "brew" }))).rejects.toBeInstanceOf(
			TenantOwnerCannotLeaveError,
		);
		expect(store.memberships.get("m-owner")?.isDeleted).toBe(false);
	});
});
