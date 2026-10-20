import type { PilotCity } from "@workspace/shared";

import { Tenant } from "../../domain/aggregates/tenant.aggregate";
import { TenantNotProvisioningError, TenantSlugTakenError } from "../../domain/errors/tenants.errors";
import type { TenantRepository } from "../../domain/repositories/tenant.repository";
import { readTransactionCorrelationId } from "../../../../prisma/transaction-correlation";
import type { TenantsDb } from "./tenant-db";
import { allocateUniqueTenantSlug } from "./tenant-slug";
import { withUniqueViolationAs } from "./unique-violation";
import { newRowId } from "@workspace/shared";

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
		await this.appendLifecycleEvents(tenant);
	}

	public async findById(tenantId: string): Promise<Tenant | null> {
		const row = await this.db.tenant.findFirst({
			where: { id: tenantId, isDeleted: false },
			select: { id: true, slug: true, displayName: true, lifecycleState: true },
		});
		return row === null ? null : Tenant.rehydrate(row);
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
				...(tenant.displayNameChanged ? { displayName: tenant.displayName } : {}),
				updatedAt,
			},
		});
		if (changed.count !== 1) {
			throw new TenantNotProvisioningError();
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
