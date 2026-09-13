import { Injectable, Logger } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { OrganizationAuditService } from "../organization/services/organization-audit.service";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/** Provider-portable envelope encryption — VPS pilot uses local master key; migrate to KMS later. */
@Injectable()
export class TenantEncryptionService {
	private readonly logger: Logger = new Logger(TenantEncryptionService.name);
	private readonly masterKey: Buffer;

	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly audit: OrganizationAuditService,
	) {
		const masterSecret = process.env.TENANT_ENCRYPTION_MASTER_KEY ?? "pilot-dev-master-key-change-me";
		this.masterKey = createHash("sha256").update(masterSecret).digest();
	}

	public async ensureOrganizationKey(organizationId: string, actorUserId: string | null): Promise<number> {
		const existing = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.provision",
				reason: "Ensure tenant encryption key",
				correlationId: `dek:${organizationId}`,
				actorUserId,
			},
			async (tx) =>
				tx.tenantEncryptionKey.findFirst({
					where: { organizationId, status: "ACTIVE" },
					orderBy: { keyVersion: "desc" },
				}),
		);

		if (existing !== null) {
			return existing.keyVersion;
		}

		const dataKey = randomBytes(32);
		const wrappedKey = this.wrapKey(dataKey);

		const row = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.provision",
				reason: "Create tenant encryption key",
				correlationId: `dek-create:${organizationId}`,
				actorUserId,
			},
			async (tx) =>
				tx.tenantEncryptionKey.create({
					data: {
						organizationId,
						keyVersion: 1,
						wrappedKey,
						kmsKeyId: "local:pilot",
						status: "ACTIVE",
					},
				}),
		);

		this.logger.log(`Created tenant DEK v${row.keyVersion} for org ${organizationId}`);
		return row.keyVersion;
	}

	public async encrypt(organizationId: string, plaintext: string, actorUserId: string | null): Promise<string> {
		const keyVersion = await this.ensureOrganizationKey(organizationId, actorUserId);
		const dataKey = await this.unwrapOrganizationKey(organizationId, keyVersion, actorUserId);
		const iv = randomBytes(IV_LENGTH);
		const cipher = createCipheriv(ALGORITHM, dataKey, iv);
		const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
		const tag = cipher.getAuthTag();
		return `${keyVersion}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
	}

	public async decrypt(organizationId: string, payload: string, actorUserId: string | null, purpose: string): Promise<string> {
		const [versionStr, ivB64, tagB64, dataB64] = payload.split(":");
		const keyVersion = Number.parseInt(versionStr, 10);
		const dataKey = await this.unwrapOrganizationKey(organizationId, keyVersion, actorUserId);

		await this.audit.record({
			organizationId,
			actorUserId,
			action: "encryption.decrypt",
			resourceType: "TenantEncryptionKey",
			resourceId: String(keyVersion),
			metadata: { purpose },
		});

		const decipher = createDecipheriv(ALGORITHM, dataKey, Buffer.from(ivB64, "base64"));
		decipher.setAuthTag(Buffer.from(tagB64, "base64"));
		const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
		return decrypted.toString("utf8");
	}

	private wrapKey(dataKey: Buffer): string {
		const iv = randomBytes(IV_LENGTH);
		const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);
		const wrapped = Buffer.concat([cipher.update(dataKey), cipher.final()]);
		const tag = cipher.getAuthTag();
		return `${iv.toString("base64")}:${tag.toString("base64")}:${wrapped.toString("base64")}`;
	}

	private unwrapWrappedKey(wrappedKey: string): Buffer {
		const [ivB64, tagB64, dataB64] = wrappedKey.split(":");
		const decipher = createDecipheriv(ALGORITHM, this.masterKey, Buffer.from(ivB64, "base64"));
		decipher.setAuthTag(Buffer.from(tagB64, "base64"));
		return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
	}

	private async unwrapOrganizationKey(organizationId: string, keyVersion: number, actorUserId: string | null): Promise<Buffer> {
		const row = await this.tenantTx.withSystemOperation(
			{
				operation: "organization.provision",
				reason: "Unwrap tenant DEK",
				correlationId: `dek-unwrap:${organizationId}:${keyVersion}`,
				actorUserId,
			},
			async (tx) =>
				tx.tenantEncryptionKey.findUnique({
					where: { organizationId_keyVersion: { organizationId, keyVersion } },
				}),
		);
		if (row === null) {
			throw new Error(`Tenant encryption key not found: ${organizationId} v${keyVersion}`);
		}
		return this.unwrapWrappedKey(row.wrappedKey);
	}
}
