import { Injectable } from "@nestjs/common";
import type { Prisma, TenantEncryptionKey } from "@prisma/client";

import type { WrappedDataKey } from "./kms/tenant-key-management.port";

/** Delegates tenant key access runs through (always the caller's transaction). */
export type TenantEncryptionKeyDbClient = Pick<Prisma.TransactionClient, "tenantEncryptionKey" | "user">;

export interface NewTenantKeyRecord extends WrappedDataKey {
	readonly organizationId: string;
	readonly keyVersion: number;
}

/** Prisma access for wrapped tenant data keys. */
@Injectable()
export class TenantEncryptionKeyRepository {
	public async findActiveKey(organizationId: string, db: TenantEncryptionKeyDbClient): Promise<TenantEncryptionKey | null> {
		return db.tenantEncryptionKey.findFirst({ where: { organizationId, status: "ACTIVE" }, orderBy: { keyVersion: "desc" } });
	}

	/**
	 * `INSERT ... ON CONFLICT DO NOTHING`: two concurrent creators race on the
	 * (organization, keyVersion) unique key and the one-ACTIVE-key-per-organization
	 * partial unique index; exactly one row wins, the loser inserts nothing (0).
	 */
	public async insertKeyIfAbsent(record: NewTenantKeyRecord, db: TenantEncryptionKeyDbClient): Promise<number> {
		const created = await db.tenantEncryptionKey.createMany({
			data: [{ organizationId: record.organizationId, keyVersion: record.keyVersion, wrappedKey: record.wrappedKey, kmsKeyId: record.kmsKeyId, status: "ACTIVE" }],
			skipDuplicates: true,
		});
		return created.count;
	}

	public async findKey(organizationId: string, keyVersion: number, db: TenantEncryptionKeyDbClient): Promise<TenantEncryptionKey | null> {
		return db.tenantEncryptionKey.findUnique({ where: { organizationId_keyVersion: { organizationId, keyVersion } } });
	}

	/** One keyset page of keys wrapped with any KEK other than `currentKmsKeyId`. */
	public async listKeysNotWrappedWith(currentKmsKeyId: string, afterId: string | null, take: number, db: TenantEncryptionKeyDbClient): Promise<TenantEncryptionKey[]> {
		return db.tenantEncryptionKey.findMany({
			where: { kmsKeyId: { not: currentKmsKeyId }, ...(afterId === null ? {} : { id: { gt: afterId } }) },
			orderBy: { id: "asc" },
			take,
		});
	}

	/** Compare-and-swap of the wrapped key: 1 only if nobody re-wrapped the row since it was read. */
	public async swapWrappedKey(id: string, expected: WrappedDataKey, next: WrappedDataKey, rotatedAt: number, db: TenantEncryptionKeyDbClient): Promise<number> {
		const updated = await db.tenantEncryptionKey.updateMany({
			where: { id, kmsKeyId: expected.kmsKeyId, wrappedKey: expected.wrappedKey },
			data: { kmsKeyId: next.kmsKeyId, wrappedKey: next.wrappedKey, rotatedAt },
		});
		return updated.count;
	}

	public async isActiveSuperAdmin(userId: string, db: TenantEncryptionKeyDbClient): Promise<boolean> {
		const user = await db.user.findFirst({ where: { id: userId, isSuperAdmin: true, isActive: true, isDeleted: false }, select: { id: true } });
		return user !== null;
	}
}
