import { Inject, Injectable, Logger } from "@nestjs/common";
import type { TenantEncryptionKey } from "@prisma/client";
import { nowEpochMs } from "@workspace/shared";
import { randomBytes } from "node:crypto";

import { RequestContextService } from "../context/request-context";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import type { SystemOperation } from "../../../prisma/system-operation.registry";
import { CEDAR_POLICY_EVALUATOR, type CedarPolicyEvaluatorPort } from "../../../contexts/authorization/public-api";
import { TENANT_AUDIT, type TenantAuditEntry, type TenantAuditPort, type TenantAuditTransaction } from "../../../contexts/tenancy/public-api";
import { AES_256_KEY_BYTES, formatGcmEnvelope, gcmDecrypt, gcmEncrypt, parseGcmEnvelope } from "./aes-256-gcm";
import { TENANT_KEY_MANAGEMENT, type TenantKeyManagementPort, type WrappedDataKey } from "./kms/tenant-key-management.port";
import { TenantEncryptionKeyRepository, type TenantEncryptionKeyDbClient } from "./tenant-encryption-key.repository";

/** First data-key version of a tenant. */
const INITIAL_DATA_KEY_VERSION = 1;
/** Data-key version prefix of a tenant ciphertext: `<keyVersion>:<iv>:<tag>:<data>`. */
const CIPHERTEXT_PATTERN = /^(?<keyVersion>[1-9]\d*):(?<envelope>.+)$/;
/** Keys re-wrapped per page (one read transaction per page, one write transaction per key). */
export const REWRAP_PAGE_SIZE = 100;

const AUDIT_RESOURCE_TYPE = "TenantEncryptionKey";
export const TENANT_KEY_AUDIT_ACTIONS = {
	created: "encryption.tenant_key.created",
	decrypted: "encryption.decrypt",
	rewrapped: "encryption.tenant_key.rewrapped",
} satisfies Record<string, string>;

/** A tenant ciphertext that cannot be parsed, or names no key. */
export class TenantCiphertextError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "TenantCiphertextError";
	}
}

/** The ciphertext (or encrypt) names a data-key version the tenant does not have. */
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
		@Inject(CEDAR_POLICY_EVALUATOR) private readonly cedar: CedarPolicyEvaluatorPort,
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
		const policyVersion: number = await this.cedar.getActivePolicyVersion(tenantId);
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
					await this.audit.recordInTx(db, this.auditEntry(row, actorUserId, policyVersion, TENANT_KEY_AUDIT_ACTIONS.created, { kmsKeyId: row.kmsKeyId }));
				}
				return { row, inserted: inserted === 1 };
			},
		);
		if (created.inserted) {
			this.logger.log(`Created tenant DEK v${String(created.row.keyVersion)} for tenant ${tenantId} (${created.row.kmsKeyId})`);
		}
		return created.row.keyVersion;
	}

	public async encrypt(tenantId: string, plaintext: string, actorUserId: string): Promise<string> {
		const keyVersion: number = await this.ensureTenantKey(tenantId, actorUserId);
		const row: TenantEncryptionKey = await this.requireKey(tenantId, keyVersion, actorUserId);
		const dataKey: Buffer = await this.kms.unwrapDataKey(row);
		return `${String(keyVersion)}:${formatGcmEnvelope(gcmEncrypt(dataKey, Buffer.from(plaintext, "utf8")))}`;
	}

	/** Decrypts and authenticates; the decrypt is audited (with its purpose) before key material is used. */
	public async decrypt(tenantId: string, payload: string, actorUserId: string, purpose: string): Promise<string> {
		const match = CIPHERTEXT_PATTERN.exec(payload);
		const keyVersionText: string | undefined = match?.groups?.keyVersion;
		const envelopeText: string | undefined = match?.groups?.envelope;
		if (keyVersionText === undefined || envelopeText === undefined) {
			throw new TenantCiphertextError("Malformed tenant ciphertext: expected <keyVersion>:<iv>:<tag>:<ciphertext>");
		}
		const keyVersion = Number(keyVersionText);
		const envelope = parseGcmEnvelope(envelopeText);
		const policyVersion: number = await this.cedar.getActivePolicyVersion(tenantId);

		const row: TenantEncryptionKey = await this.system("encryption.tenant_key.unwrap", "Audit and read the tenant key for decrypt", actorUserId, async (db) => {
			const key: TenantEncryptionKey | null = await this.keys.findKey(tenantId, keyVersion, db);
			if (key === null) {
				throw new TenantKeyNotFoundError(tenantId, keyVersion);
			}
			await this.audit.recordInTx(db, this.auditEntry(key, actorUserId, policyVersion, TENANT_KEY_AUDIT_ACTIONS.decrypted, { purpose }));
			return key;
		});

		const dataKey: Buffer = await this.kms.unwrapDataKey(row);
		return gcmDecrypt(dataKey, envelope).toString("utf8");
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
		const policyVersion: number = await this.cedar.getActivePolicyVersion(row.tenantId);
		return this.system("encryption.tenant_key.rewrap", "Swap in the re-wrapped tenant key", actorUserId, async (db) => {
			const swapped: number = await this.keys.swapWrappedKey(row.id, row, next, nowEpochMs(), db);
			if (swapped !== 1) {
				return "concurrently-updated";
			}
			await this.audit.recordInTx(
				db,
				this.auditEntry(row, actorUserId, policyVersion, TENANT_KEY_AUDIT_ACTIONS.rewrapped, { fromKmsKeyId: row.kmsKeyId, toKmsKeyId: next.kmsKeyId }),
			);
			return "rewrapped";
		});
	}

	private async requireKey(tenantId: string, keyVersion: number, actorUserId: string): Promise<TenantEncryptionKey> {
		const row: TenantEncryptionKey | null = await this.system("encryption.tenant_key.unwrap", "Read the tenant key for encrypt", actorUserId, (db) =>
			this.keys.findKey(tenantId, keyVersion, db),
		);
		if (row === null) {
			throw new TenantKeyNotFoundError(tenantId, keyVersion);
		}
		return row;
	}

	private async system<T>(
		operation: SystemOperation,
		reason: string,
		actorUserId: string,
		work: (db: TenantEncryptionKeyDbClient & TenantAuditTransaction) => Promise<T>,
	): Promise<T> {
		return this.tenantTx.withSystemOperation({ operation, reason, actorUserId }, work);
	}

	private auditEntry(row: TenantEncryptionKey, actorUserId: string, policyVersion: number, action: string, metadata: Readonly<Record<string, string>>): TenantAuditEntry {
		const correlationId: string | undefined = this.requestContext.correlationId();
		return {
			tenantId: row.tenantId,
			actorUserId,
			policyVersion,
			action,
			resourceType: AUDIT_RESOURCE_TYPE,
			resourceId: row.id,
			metadata: { ...metadata, keyVersion: row.keyVersion },
			...(correlationId === undefined ? {} : { correlationId }),
		};
	}
}
