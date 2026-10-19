import type { PilotCity } from "@workspace/shared";

import { Organization } from "../../domain/aggregates/organization.aggregate";
import { OrganizationNotProvisioningError, OrganizationSlugTakenError } from "../../domain/errors/organizations.errors";
import type { OrganizationRepository } from "../../domain/repositories/organization.repository";
import { readTransactionCorrelationId } from "../../../../prisma/transaction-correlation";
import type { OrganizationsDb } from "./organization-db";
import { allocateUniqueOrganizationSlug } from "./organization-slug";
import { withUniqueViolationAs } from "./unique-violation";
import { newRowId } from "@workspace/shared";

/** Shared tenant placement every organization starts in (dedicated placement is an operator migration). */
const DEFAULT_PLACEMENT = { kind: "SHARED", regionCode: "default" } satisfies { readonly kind: "SHARED"; readonly regionCode: string };

export class PrismaOrganizationRepository implements OrganizationRepository {
	public constructor(private readonly db: OrganizationsDb) {}

	public nextId(): string {
		return newRowId();
	}

	public async allocateSlug(displayName: string): Promise<string> {
		return allocateUniqueOrganizationSlug(this.db, displayName);
	}

	public async add(organization: Organization): Promise<void> {
		const profile = organization.provisionedProfile;
		if (profile === null) {
			throw new Error(`Organization ${organization.id} has no provisioning profile`);
		}
		await withUniqueViolationAs(
			async () =>
				this.db.organization.create({
					data: {
						id: organization.id,
						slug: organization.slug,
						displayName: organization.displayName,
						lifecycleState: organization.lifecycleState,
						merchantProfile: { create: { category: profile.category, city: profile.city, contactEmail: profile.contactEmail, kybStatus: "PENDING" } },
						placement: { create: { ...DEFAULT_PLACEMENT } },
					},
				}),
			() => new OrganizationSlugTakenError(),
		);
		await this.appendLifecycleEvents(organization);
	}

	public async findById(organizationId: string): Promise<Organization | null> {
		const row = await this.db.organization.findFirst({
			where: { id: organizationId, isDeleted: false },
			select: { id: true, slug: true, displayName: true, lifecycleState: true },
		});
		return row === null ? null : Organization.rehydrate(row);
	}

	public async findMerchantCity(organizationId: string): Promise<PilotCity | null> {
		const row = await this.db.organization.findFirst({ where: { id: organizationId, isDeleted: false }, select: { merchantProfile: { select: { city: true } } } });
		return row?.merchantProfile?.city ?? null;
	}

	public async save(organization: Organization): Promise<void> {
		const loaded = organization.concurrencyToken;
		if (loaded === null) {
			throw new Error(`Organization ${organization.id} was never persisted`);
		}
		const updatedAt = BigInt(Date.now());
		const changed = await this.db.organization.updateMany({
			where: { id: organization.id, lifecycleState: loaded, isDeleted: false },
			data: {
				lifecycleState: organization.lifecycleState,
				...(organization.displayNameChanged ? { displayName: organization.displayName } : {}),
				updatedAt,
			},
		});
		if (changed.count !== 1) {
			throw new OrganizationNotProvisioningError();
		}
		await this.appendLifecycleEvents(organization);
	}

	/** The only writer of `OrganizationLifecycleEvent`: each row carries the transaction's correlation id. */
	private async appendLifecycleEvents(organization: Organization): Promise<void> {
		if (organization.pendingTransitions.length === 0) {
			return;
		}
		const correlationId = await readTransactionCorrelationId(this.db);
		for (const transition of organization.pendingTransitions) {
			await this.db.organizationLifecycleEvent.create({
				data: {
					organizationId: organization.id,
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
