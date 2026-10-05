import { randomBytes } from "node:crypto";

import type { TenantEncryptionKey } from "@prisma/client";

import { getApiConfig } from "../../src/config/api-config";
import type { TenantKmsProvider } from "../../src/config/api-env.fields";
import { TypedConfigService } from "../../src/config/typed-config.service";
import { NO_PUBLISHED_POLICY_VERSION } from "../../src/modules/authorization-cedar/services/policy-bundle";
import { AES_256_KEY_BYTES, formatGcmEnvelope, gcmEncrypt } from "../../src/modules/encryption/aes-256-gcm";
import { LEGACY_PILOT_KEK_ID } from "../../src/modules/encryption/kms/local-development-key-management.service";
import { createTenantKeyManagement } from "../../src/modules/encryption/kms/tenant-key-management.factory";
import type { TenantKeyManagementPort, WrappedDataKey } from "../../src/modules/encryption/kms/tenant-key-management.port";
import { TENANT_KEY_AUDIT_ACTIONS } from "../../src/modules/encryption/tenant-encryption.service";

import { prisma } from "./client";
import { seedLog } from "./seed-log";

/** First data-key version of an organization (as `TenantEncryptionService` creates it). */
const INITIAL_DATA_KEY_VERSION = 1;

export interface TenantKeySeedTarget {
	readonly organizationId: string;
	/** The user who provisioned the organization — the audited actor. */
	readonly actorUserId: string;
	/**
	 * Set for a tenant whose key has been through a KEK re-wrap: the active SuperAdmin who ran
	 * `pnpm db:rewrap-tenant-keys`. The key then carries `rotated_at` and the
	 * `encryption.tenant_key.rewrapped` audit row, exactly as the command leaves them.
	 */
	readonly rewrappedByUserId?: string;
}

/** Version of the KEK that wrapped every pre-versioning (`local:pilot`) data key. */
const LEGACY_PILOT_KEK_VERSION = 1;

/**
 * Raw KEK material a provider's legacy pilot rows were wrapped with, or null when the provider
 * holds none. A `Record` over the provider union: adding a provider fails to compile until the seed
 * says how (or whether) it can reproduce a pre-rotation row.
 */
const LEGACY_KEK_MATERIAL: Readonly<Record<TenantKmsProvider, (config: TypedConfigService) => Buffer | null>> = {
	local: (config: TypedConfigService): Buffer | null =>
		config.encryption.tenantMasterKeyVersion === LEGACY_PILOT_KEK_VERSION
			? config.tenantEncryptionMasterKey
			: (config.tenantEncryptionPreviousMasterKeys.get(LEGACY_PILOT_KEK_VERSION) ?? null),
};

/**
 * Re-wraps the key the way `TenantEncryptionService.rewrapToCurrentKek` does: the data key as a
 * legacy `local:pilot` envelope is unwrapped, wrapped under the CURRENT KEK and swapped in with a
 * compare-and-swap that stamps `rotated_at`, together with the audit row. The data key itself is
 * unchanged. Returns false when the provider cannot reproduce a legacy row (nothing is written).
 */
async function rewrapFromLegacyPilot(kms: TenantKeyManagementPort, config: TypedConfigService, key: TenantEncryptionKey, actorUserId: string): Promise<boolean> {
	const material: Buffer | null = LEGACY_KEK_MATERIAL[config.encryption.tenantKmsProvider](config);
	if (material === null) {
		seedLog(`⚠️  Tenant key ${key.id} not rotated: the ${config.encryption.tenantKmsProvider} provider holds no legacy KEK material`);
		return false;
	}
	const dataKey: Buffer = await kms.unwrapDataKey(key);
	const legacy: WrappedDataKey = { kmsKeyId: LEGACY_PILOT_KEK_ID, wrappedKey: formatGcmEnvelope(gcmEncrypt(material, dataKey)) };
	const next: WrappedDataKey = await kms.wrapDataKey(await kms.unwrapDataKey(legacy));
	if (!(await kms.unwrapDataKey(next)).equals(dataKey)) {
		throw new Error(`Seed re-wrap of tenant key ${key.id} does not round-trip`);
	}
	const policy = await prisma.authorizationPolicyVersion.findFirst({
		where: { organizationId: key.organizationId, scope: "TENANT", supersededAt: null },
		select: { version: true },
	});
	await prisma.$transaction(async (tx) => {
		const swapped = await tx.tenantEncryptionKey.updateMany({
			where: { id: key.id, kmsKeyId: key.kmsKeyId, wrappedKey: key.wrappedKey, rotatedAt: null },
			data: { kmsKeyId: next.kmsKeyId, wrappedKey: next.wrappedKey, rotatedAt: Date.now() },
		});
		if (swapped.count !== 1) {
			return;
		}
		await tx.organizationAuditLog.create({
			data: {
				organizationId: key.organizationId,
				actorUserId,
				action: TENANT_KEY_AUDIT_ACTIONS.rewrapped,
				resourceType: "TenantEncryptionKey",
				resourceId: key.id,
				policyVersion: policy?.version ?? NO_PUBLISHED_POLICY_VERSION,
				metadata: { fromKmsKeyId: legacy.kmsKeyId, toKmsKeyId: next.kmsKeyId, keyVersion: key.keyVersion },
			},
		});
	});
	return true;
}

/**
 * Creates each organization's first data key through the configured KMS
 * provider (`TENANT_KMS_PROVIDER`, KEK from `TENANT_ENCRYPTION_MASTER_KEY`),
 * so seeded rows are real, unwrappable envelopes — never placeholders. Rows,
 * key versions and KMS key ids are deterministic; the data keys themselves are
 * random, as they must be. Each key gets the audit row the app writes.
 * Returns how many keys were created.
 */
export async function seedTenantEncryptionKeys(targets: readonly TenantKeySeedTarget[]): Promise<number> {
	const config = new TypedConfigService(getApiConfig());
	const kms = createTenantKeyManagement(config);
	let created = 0;
	for (const target of targets) {
		// Idempotent: an organization that already has its ACTIVE data key keeps it (its re-wrap, when seeded, happens once).
		const existing = await prisma.tenantEncryptionKey.findFirst({ where: { organizationId: target.organizationId, status: "ACTIVE" } });
		if (existing !== null) {
			if (target.rewrappedByUserId !== undefined && existing.rotatedAt === null) {
				await rewrapFromLegacyPilot(kms, config, existing, target.rewrappedByUserId);
			}
			continue;
		}
		const dataKey: Buffer = randomBytes(AES_256_KEY_BYTES);
		const wrapped = await kms.wrapDataKey(dataKey);
		// Prove the envelope round-trips before it is stored.
		if (!(await kms.unwrapDataKey(wrapped)).equals(dataKey)) {
			throw new Error(`Seed tenant key for ${target.organizationId} does not round-trip`);
		}
		const policy = await prisma.authorizationPolicyVersion.findFirst({
			where: { organizationId: target.organizationId, scope: "TENANT", supersededAt: null },
			select: { version: true },
		});
		await prisma.$transaction(async (tx) => {
			const key = await tx.tenantEncryptionKey.create({
				data: { organizationId: target.organizationId, keyVersion: INITIAL_DATA_KEY_VERSION, wrappedKey: wrapped.wrappedKey, kmsKeyId: wrapped.kmsKeyId, status: "ACTIVE" },
			});
			await tx.organizationAuditLog.create({
				data: {
					organizationId: target.organizationId,
					actorUserId: target.actorUserId,
					action: TENANT_KEY_AUDIT_ACTIONS.created,
					resourceType: "TenantEncryptionKey",
					resourceId: key.id,
					policyVersion: policy?.version ?? NO_PUBLISHED_POLICY_VERSION,
					metadata: { kmsKeyId: key.kmsKeyId, keyVersion: key.keyVersion },
				},
			});
		});
		created += 1;
		if (target.rewrappedByUserId !== undefined) {
			const key = await prisma.tenantEncryptionKey.findFirstOrThrow({ where: { organizationId: target.organizationId, status: "ACTIVE" } });
			await rewrapFromLegacyPilot(kms, config, key, target.rewrappedByUserId);
		}
	}
	return created;
}
