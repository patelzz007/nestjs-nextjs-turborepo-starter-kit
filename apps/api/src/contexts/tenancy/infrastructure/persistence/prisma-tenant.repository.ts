import type { Prisma } from "@prisma/client";
import { epochMs, newRowId, UuidParamSchema, type PilotCity } from "@workspace/shared";

import { ConcurrentModificationError } from "../../../../platform/infrastructure/persistence/persistence.errors";
import { Tenant } from "../../domain/aggregates/tenant.aggregate";
import { TenantNotProvisioningError, TenantSlugTakenError } from "../../domain/errors/tenants.errors";
import type { TenantRepository } from "../../domain/repositories/tenant.repository";
import { readTransactionCorrelationId } from "../../../../prisma/transaction-correlation";
import type { TenantsDb } from "./tenant-db";
import { allocateUniqueTenantSlug } from "./tenant-slug";
import { TenantRoleCopies } from "../../../authorization/public-api";
import { withUniqueViolationAs } from "./unique-violation";

const TENANT_SELECT = { id: true, slug: true, displayName: true, lifecycleState: true, deletionGraceEndsAt: true } satisfies Prisma.TenantSelect;

function toTenant(row: Prisma.TenantGetPayload<{ select: typeof TENANT_SELECT }>): Tenant {
	return Tenant.rehydrate({ ...row, deletionGraceEndsAt: row.deletionGraceEndsAt === null ? null : epochMs(Number(row.deletionGraceEndsAt)) });
}

/** Shared tenant placement every tenant starts in (dedicated placement is an operator migration). */
const DEFAULT_PLACEMENT = { kind: "SHARED", regionCode: "default" } satisfies { readonly kind: "SHARED"; readonly regionCode: string };

export class PrismaTenantRepository implements TenantRepository {
	public constructor(private readonly db: TenantsDb) {}

	public nextId(): string {
		return newRowId();
	}

	public async allocateSlug(displayName: string): Promise<string> {
		return allocateUniqueTenantSlug(this.db, displayName);
	}

	public async add(tenant: Tenant): Promise<void> {
		const profile = tenant.provisionedProfile;
		if (profile === null) {
			throw new Error(`Tenant ${tenant.id} has no provisioning profile`);
		}
		await withUniqueViolationAs(
			async () =>
				this.db.tenant.create({
					data: {
						id: tenant.id,
						slug: tenant.slug,
						displayName: tenant.displayName,
						lifecycleState: tenant.lifecycleState,
						merchantProfile: { create: { category: profile.category, city: profile.city, contactEmail: profile.contactEmail, kybStatus: "PENDING" } },
						placement: { create: { ...DEFAULT_PLACEMENT } },
					},
				}),
			() => new TenantSlugTakenError(),
		);
		// The tenant's own Owner / Manager / Cashier, copied from the templates in the same transaction (ADR 067).
		await new TenantRoleCopies(this.db).provision(tenant.id, null);
		await this.appendLifecycleEvents(tenant);
	}

	public async findById(tenantId: string): Promise<Tenant | null> {
		const row = await this.db.tenant.findFirst({ where: { id: tenantId, isDeleted: false }, select: TENANT_SELECT });
		return row === null ? null : toTenant(row);
	}

	public async findByRouteKey(routeKey: string): Promise<Tenant | null> {
		const row = await this.db.tenant.findFirst({
			where: {
				isDeleted: false,
				lifecycleState: { not: "DELETED" },
				OR: [{ slug: routeKey }, { slugHistory: { some: { slug: routeKey } } }, ...(UuidParamSchema.safeParse(routeKey).success ? [{ id: routeKey }] : [])],
			},
			select: TENANT_SELECT,
		});
		return row === null ? null : toTenant(row);
	}

	public async findMerchantCity(tenantId: string): Promise<PilotCity | null> {
		const row = await this.db.tenant.findFirst({ where: { id: tenantId, isDeleted: false }, select: { merchantProfile: { select: { city: true } } } });
		return row?.merchantProfile?.city ?? null;
	}

	public async save(tenant: Tenant): Promise<void> {
		const loaded = tenant.concurrencyToken;
		if (loaded === null) {
			throw new Error(`Tenant ${tenant.id} was never persisted`);
		}
		const updatedAt = BigInt(Date.now());
		const changed = await this.db.tenant.updateMany({
			where: { id: tenant.id, lifecycleState: loaded, isDeleted: false },
			data: {
				lifecycleState: tenant.lifecycleState,
				deletionGraceEndsAt: tenant.deletionGraceEndsAt,
				...(tenant.displayNameChanged ? { displayName: tenant.displayName } : {}),
				updatedAt,
			},
		});
		if (changed.count !== 1) {
			// Onboarding activation keeps its own answer; any other lost compare-and-set is a concurrent change.
			throw loaded === "PROVISIONING" ? new TenantNotProvisioningError() : new ConcurrentModificationError(tenant.id);
		}
		await this.appendLifecycleEvents(tenant);
	}

	/** The only writer of `TenantLifecycleEvent`: each row carries the transaction's correlation id. */
	private async appendLifecycleEvents(tenant: Tenant): Promise<void> {
		if (tenant.pendingTransitions.length === 0) {
			return;
		}
		const correlationId = await readTransactionCorrelationId(this.db);
		for (const transition of tenant.pendingTransitions) {
			await this.db.tenantLifecycleEvent.create({
				data: {
					tenantId: tenant.id,
					fromState: transition.from,
					toState: transition.to,
					actorUserId: transition.actorUserId,
					reason: transition.reason,
					correlationId,
				},
			});
		}
	}
}
