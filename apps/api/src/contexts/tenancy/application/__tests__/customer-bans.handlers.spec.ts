import { epochMs, MERCHANT_CAPABILITY, TenantCustomerBanListQuerySchema, type PaginatedServiceResult, type TenantCustomerBanResponse } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { MerchantAccessGrant, MerchantAccessPort, MerchantAccessRequest } from "../../../../platform/application/ports/authorization.port";
import type { RedemptionCustomer, RedemptionCustomerPort } from "../../../../platform/application/ports/redemption-customer.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { CustomerBan, type CustomerBanState } from "../../domain/aggregates/customer-ban.aggregate";
import { TenantCustomerAlreadyBannedError, TenantCustomerBanNotFoundError, TenantRedemptionNotFoundError } from "../../domain/errors/tenants.errors";
import type { CustomerBanRepository } from "../../domain/repositories/customer-ban.repository";
import { BanCustomerCommand } from "../commands/ban-customer/ban-customer.command";
import { BanCustomerHandler } from "../commands/ban-customer/ban-customer.handler";
import { LiftCustomerBanCommand } from "../commands/lift-customer-ban/lift-customer-ban.command";
import { LiftCustomerBanHandler } from "../commands/lift-customer-ban/lift-customer-ban.handler";
import type { CustomerBanReadPort } from "../ports/customer-ban-read.port";
import type { TenantAuditEntry } from "../ports/tenant-audit.port";
import type { ResolvedTenantMember, TenantDirectoryPort } from "../ports/tenant-directory.port";
import { ListCustomerBansHandler } from "../queries/list-customer-bans/list-customer-bans.handler";
import { ListCustomerBansQuery } from "../queries/list-customer-bans/list-customer-bans.query";
import type { TenantsScope } from "../tenants-scope";

const TENANT_ID = "0199a1b2-0000-7000-8000-000000000001";
const MANAGER_ID = "0199a1b2-0000-7000-8000-000000000002";
const CUSTOMER_ID = "0199a1b2-0000-7000-8000-000000000003";
const REDEMPTION_ID = "0199a1b2-0000-7000-8000-000000000004";
const OTHER_REDEMPTION_ID = "0199a1b2-0000-7000-8000-000000000005";
const SLUG = "brew";
const NOW = epochMs(1_792_368_000_000);
const CLOCK: Clock = { now: () => NOW };
const POLICY_VERSION = 3;

const MANAGER: ActorContext = {
	kind: "user",
	userId: MANAGER_ID,
	sessionId: "session-1",
	tenantId: TENANT_ID,
	isSuperAdmin: false,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
};

/** A store-limited admin: only store A's redemptions are theirs to ban from. */
const STORE_GRANT: MerchantAccessGrant = { tenantId: TENANT_ID, locationScope: "SELECTED", locationIds: ["store-a"] };

type BanScope = Pick<TenantsScope, "redemptionCustomers" | "customerBans" | "audit">;

/** The tenant's redemptions (by store) and bans as stored rows; a throwing unit of work leaves them untouched. */
class BanStore implements UnitOfWork<BanScope> {
	public readonly redemptions = new Map<string, RedemptionCustomer & { readonly locationId: string }>();
	public readonly bans = new Map<string, CustomerBanState & { readonly liftedAt: number | null }>();
	public readonly audit: TenantAuditEntry[] = [];
	public readonly operations: string[] = [];
	private nextBan = 0;

	public run<TResult>(_actor: ActorContext, work: (scope: BanScope) => Promise<TResult>): Promise<TResult> {
		return this.transaction(work);
	}

	public runSystemOperation<TResult>(operation: string, _actor: ActorContext, work: (scope: BanScope) => Promise<TResult>): Promise<TResult> {
		this.operations.push(operation);
		return this.transaction(work);
	}

	private async transaction<TResult>(work: (scope: BanScope) => Promise<TResult>): Promise<TResult> {
		const snapshot = { bans: new Map(this.bans), audit: this.audit.length };
		try {
			return await work(this.scope());
		} catch (error) {
			this.bans.clear();
			snapshot.bans.forEach((value, key) => this.bans.set(key, value));
			this.audit.length = snapshot.audit;
			throw error;
		}
	}

	private scope(): BanScope {
		const redemptionCustomers: RedemptionCustomerPort = {
			findRedemptionCustomer: (grant, redemptionId) => {
				const row = this.redemptions.get(redemptionId);
				const visible = row !== undefined && (grant.locationScope === "ALL_LOCATIONS" || grant.locationIds.includes(row.locationId));
				return Promise.resolve(visible ? row : null);
			},
		};
		const customerBans: CustomerBanRepository = {
			nextId: () => `ban-${String((this.nextBan += 1))}`,
			add: (ban) => {
				const active = [...this.bans.values()].some((row) => row.customerUserId === ban.customerUserId && row.liftedAt === null);
				if (active) {
					return Promise.reject(new TenantCustomerAlreadyBannedError());
				}
				this.bans.set(ban.id, { ...ban.snapshot, liftedAt: null });
				return Promise.resolve();
			},
			findActiveForUpdate: (tenantId, banId) => {
				const row = this.bans.get(banId);
				const active = row?.tenantId === tenantId && row.liftedAt === null ? row : undefined;
				return Promise.resolve(active === undefined ? null : CustomerBan.rehydrate(active));
			},
			save: (ban) => {
				const row = this.bans.get(ban.id);
				const lift = ban.lift;
				if (row?.liftedAt !== null) {
					return Promise.reject(new TenantCustomerBanNotFoundError());
				}
				if (lift !== null) {
					this.bans.set(ban.id, { ...row, liftedAt: lift.liftedAt });
				}
				return Promise.resolve();
			},
		};
		return {
			redemptionCustomers,
			customerBans,
			audit: {
				record: (entry: TenantAuditEntry): Promise<void> => {
					this.audit.push(entry);
					return Promise.resolve();
				},
			},
		};
	}
}

/** The bans as the page shows them, straight from the store. */
class StoreBanReads implements CustomerBanReadPort {
	public constructor(private readonly store: BanStore) {}

	public listActive(): Promise<PaginatedServiceResult<TenantCustomerBanResponse>> {
		const items = [...this.store.bans.values()].filter((row) => row.liftedAt === null).map((row) => this.toResponse(row));
		return Promise.resolve({ items, total: items.length, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrevious: false, nextCursor: null });
	}

	public findById(_tenantId: string, banId: string): Promise<TenantCustomerBanResponse | null> {
		const row = this.store.bans.get(banId);
		return Promise.resolve(row === undefined ? null : this.toResponse(row));
	}

	private toResponse(row: CustomerBanState): TenantCustomerBanResponse {
		const source = row.sourceRedemptionId === null ? undefined : this.store.redemptions.get(row.sourceRedemptionId);
		return {
			id: row.id,
			reason: row.reason,
			bannedAt: row.bannedAt,
			bannedBy: row.bannedByUserId === null ? null : { id: row.bannedByUserId, fullName: "Mia Admin" },
			source: source === undefined ? null : { redemptionId: source.redemptionId, rewardTitle: source.rewardTitle, redeemedAt: source.redeemedAt },
		};
	}
}

/** Every capability check, granting the store-limited scope. */
class RecordingMerchantAccess implements MerchantAccessPort {
	public readonly requests: MerchantAccessRequest[] = [];

	public assertCapability(_actor: ActorContext, request: MerchantAccessRequest): Promise<MerchantAccessGrant> {
		this.requests.push(request);
		return Promise.resolve(STORE_GRANT);
	}
}

const DIRECTORY: TenantDirectoryPort = {
	resolveMember: (): Promise<ResolvedTenantMember> =>
		Promise.resolve({
			tenantId: TENANT_ID,
			slug: SLUG,
			displayName: "Brew",
			userId: MANAGER_ID,
			membership: {
				id: "m-1",
				tenantId: TENANT_ID,
				userId: MANAGER_ID,
				role: "ADMIN",
				status: "ACTIVE",
				displayName: null,
				locationScopeType: "SELECTED",
				locationIds: ["store-a"],
				createdAt: NOW,
				updatedAt: NOW,
			},
			policyVersion: POLICY_VERSION,
		}),
	assertAccessibleLocation: () => Promise.resolve(),
	resolveTenantId: () => Promise.resolve(TENANT_ID),
};

let store: BanStore;
let reads: StoreBanReads;
let access: RecordingMerchantAccess;

function ban(redemptionId = REDEMPTION_ID, reason = "  Abusive to staff  "): Promise<TenantCustomerBanResponse> {
	return new BanCustomerHandler(store, DIRECTORY, access, reads, CLOCK).execute(new BanCustomerCommand(MANAGER, { tenantSlug: SLUG, redemptionId, reason }));
}

function lift(banId: string): Promise<void> {
	return new LiftCustomerBanHandler(store, DIRECTORY, access, CLOCK).execute(new LiftCustomerBanCommand(MANAGER, { tenantSlug: SLUG, banId }));
}

beforeEach(() => {
	store = new BanStore();
	reads = new StoreBanReads(store);
	access = new RecordingMerchantAccess();
	store.redemptions.set(REDEMPTION_ID, { redemptionId: REDEMPTION_ID, customerUserId: CUSTOMER_ID, rewardTitle: "Free latte", redeemedAt: NOW, locationId: "store-a" });
	store.redemptions.set(OTHER_REDEMPTION_ID, {
		redemptionId: OTHER_REDEMPTION_ID,
		customerUserId: CUSTOMER_ID,
		rewardTitle: "Free cake",
		redeemedAt: NOW,
		locationId: "store-b",
	});
});

describe("BanCustomerHandler", () => {
	it("bans the customer behind a redemption at the manager's store, audited, under manage_rewards", async () => {
		await expect(ban()).resolves.toEqual({
			id: "ban-1",
			reason: "Abusive to staff",
			bannedAt: NOW,
			bannedBy: { id: MANAGER_ID, fullName: "Mia Admin" },
			source: { redemptionId: REDEMPTION_ID, rewardTitle: "Free latte", redeemedAt: NOW },
		});

		expect(store.bans.get("ban-1")).toMatchObject({ tenantId: TENANT_ID, customerUserId: CUSTOMER_ID, sourceRedemptionId: REDEMPTION_ID, bannedByUserId: MANAGER_ID });
		expect(access.requests).toEqual([{ tenantId: TENANT_ID, capability: MERCHANT_CAPABILITY.manageRewards }]);
		expect(store.operations).toEqual(["tenant.customer_ban.create"]);
		expect(store.audit).toEqual([
			{
				tenantId: TENANT_ID,
				actorUserId: MANAGER_ID,
				policyVersion: POLICY_VERSION,
				action: "tenant.customer_banned",
				resourceType: "TenantCustomerBan",
				resourceId: "ban-1",
				metadata: { redemptionId: REDEMPTION_ID, reason: "Abusive to staff" },
			},
		]);
	});

	it("answers a redemption outside the manager's stores as not found, banning nobody", async () => {
		await expect(ban(OTHER_REDEMPTION_ID)).rejects.toBeInstanceOf(TenantRedemptionNotFoundError);
		await expect(ban("0199a1b2-0000-7000-8000-00000000dead")).rejects.toBeInstanceOf(TenantRedemptionNotFoundError);

		expect(store.bans.size).toBe(0);
		expect(store.audit).toEqual([]);
	});

	it("refuses a second active ban of the same customer, rolling its audit row back", async () => {
		await ban();

		await expect(ban(REDEMPTION_ID, "Again")).rejects.toBeInstanceOf(TenantCustomerAlreadyBannedError);

		expect(store.bans.size).toBe(1);
		expect(store.audit).toHaveLength(1);
	});
});

describe("LiftCustomerBanHandler", () => {
	it("lifts an active ban, audited; the customer can then be banned again", async () => {
		const created = await ban();

		await lift(created.id);

		expect(store.bans.get(created.id)?.liftedAt).toBe(NOW);
		expect(store.audit.at(-1)).toMatchObject({ action: "tenant.customer_ban_lifted", resourceId: created.id, policyVersion: POLICY_VERSION });
		expect(store.operations).toEqual(["tenant.customer_ban.create", "tenant.customer_ban.lift"]);
		await expect(ban(REDEMPTION_ID, "Back again")).resolves.toMatchObject({ id: "ban-2" });
	});

	it("answers a lifted or unknown ban as not found", async () => {
		const created = await ban();
		await lift(created.id);

		await expect(lift(created.id)).rejects.toBeInstanceOf(TenantCustomerBanNotFoundError);
		await expect(lift("ban-unknown")).rejects.toBeInstanceOf(TenantCustomerBanNotFoundError);
	});
});

describe("ListCustomerBansHandler", () => {
	it("lists the active bans after the manage_rewards check", async () => {
		const created = await ban();

		const page = await new ListCustomerBansHandler(DIRECTORY, access, reads).execute(
			new ListCustomerBansQuery(MANAGER, { tenantSlug: SLUG, query: TenantCustomerBanListQuerySchema.parse({}) }),
		);

		expect(page.items.map((item) => item.id)).toEqual([created.id]);
		expect(access.requests.at(-1)).toEqual({ tenantId: TENANT_ID, capability: MERCHANT_CAPABILITY.manageRewards });
	});
});

describe("CustomerBan", () => {
	it("trims the reason and refuses a blank one", () => {
		const issued = CustomerBan.issue("ban-1", {
			tenantId: TENANT_ID,
			customerUserId: CUSTOMER_ID,
			sourceRedemptionId: null,
			reason: "  Fraud  ",
			bannedByUserId: MANAGER_ID,
			bannedAt: NOW,
		});
		expect(issued.snapshot.reason).toBe("Fraud");
		expect(issued.lift).toBeNull();
		expect(() =>
			CustomerBan.issue("ban-2", { tenantId: TENANT_ID, customerUserId: CUSTOMER_ID, sourceRedemptionId: null, reason: "   ", bannedByUserId: null, bannedAt: NOW }),
		).toThrow();
	});
});
