import { createHash } from "node:crypto";

import { formatGcmEnvelope, gcmDecrypt, gcmEncrypt, GcmEnvelopeError, parseGcmEnvelope } from "../aes-256-gcm";
import { TenantKekUnavailableError, type TenantKeyManagementPort, type WrappedDataKey } from "./tenant-key-management.port";

/** Key ids issued by the local provider: `local-dev-kek/v<version>`. */
export const LOCAL_KEK_ID_PREFIX = "local-dev-kek/v";
const LOCAL_KEK_ID_PATTERN = /^local-dev-kek\/v(?<version>[1-9]\d*)$/;

/**
 * Key id written by the pre-versioning pilot implementation. Those DEKs were
 * wrapped with KEK version 1 material, either raw (base64-decoded) or — in the
 * earliest builds — as `sha256(<base64 text>)`. Both candidates are tried; GCM
 * authentication rejects the wrong one. `rewrap` moves them to a versioned id.
 */
export const LEGACY_PILOT_KEK_ID = "local:pilot";
const LEGACY_PILOT_KEK_VERSION = 1;

export function localKekId(version: number): string {
	return `${LOCAL_KEK_ID_PREFIX}${String(version)}`;
}

/**
 * LOCAL / DEVELOPMENT key-management provider: the KEK ring comes from the
 * environment (`TENANT_ENCRYPTION_MASTER_KEY[_VERSION]`,
 * `TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS`) and wrapping is AES-256-GCM in
 * process. Selected by `TENANT_KMS_PROVIDER=local`, which production must set
 * explicitly (config/api-config.schema.ts).
 */
export class LocalDevelopmentKeyManagementService implements TenantKeyManagementPort {
	private readonly keys: ReadonlyMap<number, Buffer>;

	public constructor(
		private readonly currentVersion: number,
		currentKey: Buffer,
		previousKeys: ReadonlyMap<number, Buffer>,
	) {
		this.keys = new Map([...previousKeys, [currentVersion, currentKey]]);
	}

	public currentKeyId(): string {
		return localKekId(this.currentVersion);
	}

	/** In-process wrap; the port is async because managed KMS providers are remote. A throw becomes a rejection. */
	public wrapDataKey(dataKey: Buffer): Promise<WrappedDataKey> {
		return new Promise<WrappedDataKey>((resolve) => {
			resolve({ kmsKeyId: this.currentKeyId(), wrappedKey: formatGcmEnvelope(gcmEncrypt(this.requireKey(this.currentVersion, this.currentKeyId()), dataKey)) });
		});
	}

	public unwrapDataKey(wrapped: WrappedDataKey): Promise<Buffer> {
		return new Promise<Buffer>((resolve) => {
			resolve(this.unwrapNow(wrapped));
		});
	}

	private unwrapNow(wrapped: WrappedDataKey): Buffer {
		const envelope = parseGcmEnvelope(wrapped.wrappedKey);
		if (wrapped.kmsKeyId === LEGACY_PILOT_KEK_ID) {
			return this.unwrapLegacyPilot(envelope);
		}
		const match = LOCAL_KEK_ID_PATTERN.exec(wrapped.kmsKeyId);
		const version: string | undefined = match?.groups?.version;
		if (version === undefined) {
			throw new TenantKekUnavailableError(wrapped.kmsKeyId);
		}
		return gcmDecrypt(this.requireKey(Number(version), wrapped.kmsKeyId), envelope);
	}

	private unwrapLegacyPilot(envelope: ReturnType<typeof parseGcmEnvelope>): Buffer {
		const material: Buffer = this.requireKey(LEGACY_PILOT_KEK_VERSION, LEGACY_PILOT_KEK_ID);
		const candidates: readonly Buffer[] = [material, createHash("sha256").update(material.toString("base64")).digest()];
		for (const candidate of candidates) {
			try {
				return gcmDecrypt(candidate, envelope);
			} catch (error) {
				if (!(error instanceof GcmEnvelopeError)) {
					throw error;
				}
			}
		}
		throw new GcmEnvelopeError(`Wrapped key ${LEGACY_PILOT_KEK_ID} does not authenticate under KEK version ${String(LEGACY_PILOT_KEK_VERSION)}`);
	}

	private requireKey(version: number, kmsKeyId: string): Buffer {
		const key: Buffer | undefined = this.keys.get(version);
		if (key === undefined) {
			throw new TenantKekUnavailableError(kmsKeyId);
		}
		return key;
	}
}
