import { Inject, Injectable, Logger } from "@nestjs/common";
import type { TenantEncryptionKey } from "@prisma/client";
import { nowEpochMs } from "@workspace/shared";
import { randomBytes } from "node:crypto";

import { RequestContextService } from "../context/request-context";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import type { SystemOperation } from "../../../prisma/system-operation.registry";
import { TENANT_AUDIT, type TenantAuditEntry, type TenantAuditPort, type TenantAuditTransaction } from "../../../contexts/tenancy/public-api";
import { AES_256_KEY_BYTES } from "./aes-256-gcm";
import { TENANT_KEY_MANAGEMENT, type TenantKeyManagementPort, type WrappedDataKey } from "./kms/tenant-key-management.port";
import { TenantEncryptionKeyRepository, type TenantEncryptionKeyDbClient } from "./tenant-encryption-key.repository";

/** First data-key version of a tenant. */
const INITIAL_DATA_KEY_VERSION = 1;
/** Keys re-wrapped per page (one read transaction per page, one write transaction per key). */
export const REWRAP_PAGE_SIZE = 100;

const AUDIT_RESOURCE_TYPE = "TenantEncryptionKey";
export const TENANT_KEY_AUDIT_ACTIONS = {
	created: "encryption.tenant_key.created",
	rewrapped: "encryption.tenant_key.rewrapped",
} satisfies Record<string, string>;

/** The tenant's data key could not be read back after it was created. */
export class TenantKeyNotFoundError extends Error {
	public constructor(tenantId: string, keyVersion: number) {
		super(`Tenant encryption key not found: tenant ${tenantId} v${String(keyVersion)}`);
		this.name = "TenantKeyNotFoundError";
	}
}

/** Re-wrap was asked for by someone who is not an active SuperAdmin. */
export class TenantKeyMaintenanceActorError extends Error {
	public constructor(actorUserId: string) {
		super(`User ${actorUserId} is not an active SuperAdmin; tenant key maintenance is refused`);
		this.name = "TenantKeyMaintenanceActorError";
	}
}

export interface TenantKeyRewrapFailure {
	readonly tenantKeyId: string;
	readonly tenantId: string;
	readonly kmsKeyId: string;
	readonly reason: string;
}

export interface TenantKeyRewrapSummary {
	readonly targetKmsKeyId: string;
	readonly rewrapped: number;
	/** Rows another process re-wrapped between our read and our write (compare-and-swap lost). */
	readonly concurrentlyUpdated: number;
	readonly failures: readonly TenantKeyRewrapFailure[];
}

/**
 * Envelope encryption per tenant: each tenant has a random
 * AES-256 data key (DEK) wrapped by the configured key-management provider's
 * key-encryption key (KEK). The provider key id stored with every wrapped DEK
 * keeps old DEKs readable after a KEK rotation; {@link rewrapToCurrentKek}
 * moves them to the current KEK. KMS calls never run inside a database
 * transaction.
 */
@Injectable()
export class TenantEncryptionService {
	private readonly logger: Logger = new Logger(TenantEncryptionService.name);

	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly keys: TenantEncryptionKeyRepository,
		@Inject(TENANT_AUDIT) private readonly audit: TenantAuditPort<TenantAuditTransaction>,
		private readonly requestContext: RequestContextService,
		@Inject(TENANT_KEY_MANAGEMENT) private readonly kms: TenantKeyManagementPort,
	) {}

	/** The tenant's active DEK version, creating (and auditing) the first one race-free. */
	public async ensureTenantKey(tenantId: string, actorUserId: string): Promise<number> {
		const existing: TenantEncryptionKey | null = await this.system("encryption.tenant_key.provision", "Read the active tenant key", actorUserId, (db) =>
			this.keys.findActiveKey(tenantId, db),
		);
		if (existing !== null) {
			return existing.keyVersion;
		}

		const wrapped: WrappedDataKey = await this.kms.wrapDataKey(randomBytes(AES_256_KEY_BYTES));
		const created: { readonly row: TenantEncryptionKey; readonly inserted: boolean } = await this.system(
			"encryption.tenant_key.provision",
			"Create the tenant key",
			actorUserId,
			async (db) => {
				const inserted: number = await this.keys.insertKeyIfAbsent({ tenantId, keyVersion: INITIAL_DATA_KEY_VERSION, ...wrapped }, db);
				const row: TenantEncryptionKey | null = await this.keys.findActiveKey(tenantId, db);
				if (row === null) {
					throw new TenantKeyNotFoundError(tenantId, INITIAL_DATA_KEY_VERSION);
				}
				if (inserted === 1) {
					await this.audit.recordInTx(db, this.auditEntry(row, actorUserId, TENANT_KEY_AUDIT_ACTIONS.created, { kmsKeyId: row.kmsKeyId }));
				}
				return { row, inserted: inserted === 1 };
			},
		);
		if (created.inserted) {
			this.logger.log(`Created tenant DEK v${String(created.row.keyVersion)} for tenant ${tenantId} (${created.row.kmsKeyId})`);
		}
		return created.row.keyVersion;
	}

	/**
	 * Re-wraps every DEK that is not wrapped with the provider's CURRENT KEK
	 * (after a KEK rotation, and for legacy pilot rows). Each key is unwrapped
	 * and re-wrapped outside any transaction, then swapped in with a
	 * compare-and-swap plus an audit row in one transaction. A key that cannot
	 * be unwrapped is reported, never skipped silently.
	 */
	public async rewrapToCurrentKek(actorUserId: string): Promise<TenantKeyRewrapSummary> {
		const authorized: boolean = await this.system("encryption.tenant_key.rewrap", "Verify the maintenance actor", actorUserId, (db) =>
			this.keys.isActiveSuperAdmin(actorUserId, db),
		);
		if (!authorized) {
			throw new TenantKeyMaintenanceActorError(actorUserId);
		}

		const targetKmsKeyId: string = this.kms.currentKeyId();
		const failures: TenantKeyRewrapFailure[] = [];
		let rewrapped = 0;
		let concurrentlyUpdated = 0;
		let cursor: string | null = null;
		for (;;) {
			const afterId: string | null = cursor;
			const page: TenantEncryptionKey[] = await this.system("encryption.tenant_key.rewrap", "List tenant keys to re-wrap", actorUserId, (db) =>
				this.keys.listKeysNotWrappedWith(targetKmsKeyId, afterId, REWRAP_PAGE_SIZE, db),
			);
			for (const row of page) {
				const outcome = await this.rewrapOne(row, actorUserId);
				if (outcome === "rewrapped") {
					rewrapped += 1;
				} else if (outcome === "concurrently-updated") {
					concurrentlyUpdated += 1;
				} else {
					failures.push({ tenantKeyId: row.id, tenantId: row.tenantId, kmsKeyId: row.kmsKeyId, reason: outcome.reason });
				}
			}
			const last: TenantEncryptionKey | undefined = page.at(-1);
			if (last === undefined || page.length < REWRAP_PAGE_SIZE) {
				break;
			}
			cursor = last.id;
		}
		return { targetKmsKeyId, rewrapped, concurrentlyUpdated, failures };
	}

	private async rewrapOne(row: TenantEncryptionKey, actorUserId: string): Promise<"rewrapped" | "concurrently-updated" | { readonly reason: string }> {
		let next: WrappedDataKey;
		try {
			next = await this.kms.wrapDataKey(await this.kms.unwrapDataKey(row));
		} catch (error) {
			if (error instanceof Error) {
				return { reason: error.message };
			}
			throw error;
		}
		return this.system("encryption.tenant_key.rewrap", "Swap in the re-wrapped tenant key", actorUserId, async (db) => {
			const swapped: number = await this.keys.swapWrappedKey(row.id, row, next, nowEpochMs(), db);
			if (swapped !== 1) {
				return "concurrently-updated";
			}
			await this.audit.recordInTx(db, this.auditEntry(row, actorUserId, TENANT_KEY_AUDIT_ACTIONS.rewrapped, { fromKmsKeyId: row.kmsKeyId, toKmsKeyId: next.kmsKeyId }));
			return "rewrapped";
		});
	}

	private async system<T>(
		operation: SystemOperation,
		reason: string,
		actorUserId: string,
		work: (db: TenantEncryptionKeyDbClient & TenantAuditTransaction) => Promise<T>,
	): Promise<T> {
		return this.tenantTx.withSystemOperation({ operation, reason, actorUserId }, work);
	}

	private auditEntry(row: TenantEncryptionKey, actorUserId: string, action: string, metadata: Readonly<Record<string, string>>): TenantAuditEntry {
		const correlationId: string | undefined = this.requestContext.correlationId();
		return {
			tenantId: row.tenantId,
			actorUserId,
			action,
			resourceType: AUDIT_RESOURCE_TYPE,
			resourceId: row.id,
			metadata: { ...metadata, keyVersion: row.keyVersion },
			...(correlationId === undefined ? {} : { correlationId }),
		};
	}
}
