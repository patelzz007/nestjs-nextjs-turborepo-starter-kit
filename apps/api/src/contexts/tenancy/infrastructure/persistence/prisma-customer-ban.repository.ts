import type { Prisma } from "@prisma/client";
import { epochMs, newRowId } from "@workspace/shared";

import { CustomerBan } from "../../domain/aggregates/customer-ban.aggregate";
import { TenantCustomerAlreadyBannedError, TenantCustomerBanNotFoundError } from "../../domain/errors/tenants.errors";
import type { CustomerBanRepository } from "../../domain/repositories/customer-ban.repository";
import type { TenantsDb } from "./tenant-db";
import { withUniqueViolationAs } from "./unique-violation";

const BAN_SELECT = {
	id: true,
	tenantId: true,
	customerUserId: true,
	sourceRedemptionId: true,
	reason: true,
	bannedByUserId: true,
	bannedAt: true,
} satisfies Prisma.TenantCustomerBanSelect;

/** Only an active ban is loaded or lifted: one not lifted and not deleted. */
const ACTIVE_BAN = { liftedAt: null, isDeleted: false } satisfies Prisma.TenantCustomerBanWhereInput;

export class PrismaCustomerBanRepository implements CustomerBanRepository {
	public constructor(private readonly db: TenantsDb) {}

	public nextId(): string {
		return newRowId();
	}

	public async add(ban: CustomerBan): Promise<void> {
		const state = ban.snapshot;
		await withUniqueViolationAs(
			async () =>
				this.db.tenantCustomerBan.create({
					data: {
						id: state.id,
						tenantId: state.tenantId,
						customerUserId: state.customerUserId,
						sourceRedemptionId: state.sourceRedemptionId,
						reason: state.reason,
						bannedByUserId: state.bannedByUserId,
						bannedAt: state.bannedAt,
						createdAt: state.bannedAt,
						updatedAt: state.bannedAt,
					},
					select: { id: true },
				}),
			() => new TenantCustomerAlreadyBannedError(),
		);
	}

	public async findActiveForUpdate(tenantId: string, banId: string): Promise<CustomerBan | null> {
		await this.db.$queryRaw`SELECT id FROM "TenantCustomerBan" WHERE id = ${banId} AND "tenantId" = ${tenantId} AND "liftedAt" IS NULL AND "isDeleted" = false FOR UPDATE`;
		const row = await this.db.tenantCustomerBan.findFirst({ where: { id: banId, tenantId, ...ACTIVE_BAN }, select: BAN_SELECT });
		return row === null ? null : CustomerBan.rehydrate({ ...row, bannedAt: epochMs(Number(row.bannedAt)) });
	}

	public async save(ban: CustomerBan): Promise<void> {
		const lift = ban.lift;
		if (lift === null) {
			return;
		}
		const written = await this.db.tenantCustomerBan.updateMany({
			where: { id: ban.id, tenantId: ban.tenantId, ...ACTIVE_BAN },
			data: { liftedAt: lift.liftedAt, liftedByUserId: lift.liftedByUserId, updatedAt: lift.liftedAt, updatedBy: lift.liftedByUserId },
		});
		if (written.count !== 1) {
			throw new TenantCustomerBanNotFoundError();
		}
	}
}
