import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import type { TenantEncryptionKey } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { createTestPrisma } from "../../../../../test/support/test-service-graph";
import { RequestContextService } from "../../context/request-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { createCedarPolicyEvaluator } from "../../../../contexts/authorization/public-api";
import { createTenantAuditPort } from "../../../../contexts/tenancy/public-api";
import { AES_256_KEY_BYTES, formatGcmEnvelope, gcmEncrypt } from "../aes-256-gcm";
import { LEGACY_PILOT_KEK_ID, LocalDevelopmentKeyManagementService, localKekId } from "../kms/local-development-key-management.service";
import { TenantKekUnavailableError } from "../kms/tenant-key-management.port";
import { TenantEncryptionKeyRepository, type NewTenantKeyRecord } from "../tenant-encryption-key.repository";
import { TENANT_KEY_AUDIT_ACTIONS, TenantEncryptionService, TenantKeyMaintenanceActorError } from "../tenant-encryption.service";
import { LIVE_ROW_FIELDS } from "../../persistence/__tests__/base-row-fields";

interface AuditRow {
	readonly data: { readonly tenantId: string; readonly actorUserId: string; readonly action: string; readonly policyVersion: number; readonly metadata?: object };
}

const db = vi.hoisted(() => {
	const auditRows: AuditRow[] = [];
	const operations: string[] = [];
	return { auditRows, operations };
});

// System operations run the work against a fake transaction exposing only the audit delegate (the repository is in-memory).
vi.mock("../../../../prisma/tenant-transaction.service", () => ({
	TenantTransactionService: class {
		public readonly withSystemOperation = async <T>(context: { readonly operation: string }, work: (tx: object) => Promise<T>): Promise<T> => {
			db.operations.push(context.operation);
			return work({
				tenantAuditLog: {
					create: (row: AuditRow): Promise<AuditRow> => {
						db.auditRows.push(row);
						return Promise.resolve(row);
					},
				},
			});
		};
	},
}));

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTOR = "11111111-1111-4111-8111-111111111111";
const NOT_SUPERADMIN = "22222222-2222-4222-8222-222222222222";
const POLICY_VERSION = 3;
const KEK_V1 = Buffer.alloc(32, 1);
const KEK_V2 = Buffer.alloc(32, 2);

/** In-memory key table with the SQL semantics the service relies on (ON CONFLICT DO NOTHING, compare-and-swap). */
class InMemoryKeyRepository extends TenantEncryptionKeyRepository {
	public rows: TenantEncryptionKey[] = [];

	public override findActiveKey(tenantId: string): Promise<TenantEncryptionKey | null> {
		return Promise.resolve(this.rows.find((row) => row.tenantId === tenantId && row.status === "ACTIVE") ?? null);
	}

	public override insertKeyIfAbsent(record: NewTenantKeyRecord): Promise<number> {
		const conflict = this.rows.some((row) => row.tenantId === record.tenantId && (row.keyVersion === record.keyVersion || row.status === "ACTIVE"));
		if (conflict) {
			return Promise.resolve(0);
		}
		this.rows.push({ ...LIVE_ROW_FIELDS, id: randomUUID(), ...record, status: "ACTIVE", rotatedAt: null, createdAt: BigInt(Date.now()), updatedAt: BigInt(Date.now()) });
		return Promise.resolve(1);
	}

	public override findKey(tenantId: string, keyVersion: number): Promise<TenantEncryptionKey | null> {
		return Promise.resolve(this.rows.find((row) => row.tenantId === tenantId && row.keyVersion === keyVersion) ?? null);
	}

	public override listKeysNotWrappedWith(currentKmsKeyId: string, afterId: string | null, take: number): Promise<TenantEncryptionKey[]> {
		return Promise.resolve(
			this.rows
				.filter((row) => row.kmsKeyId !== currentKmsKeyId && (afterId === null || row.id > afterId))
				.sort((left, right) => left.id.localeCompare(right.id))
				.slice(0, take)
				.map((row) => ({ ...row })),
		);
	}

	public override swapWrappedKey(
		id: string,
		expected: { kmsKeyId: string; wrappedKey: string },
		next: { kmsKeyId: string; wrappedKey: string },
		rotatedAt: number,
	): Promise<number> {
		const row = this.rows.find((candidate) => candidate.id === id && candidate.kmsKeyId === expected.kmsKeyId && candidate.wrappedKey === expected.wrappedKey);
		if (row === undefined) {
			return Promise.resolve(0);
		}
		row.kmsKeyId = next.kmsKeyId;
		row.wrappedKey = next.wrappedKey;
		row.rotatedAt = BigInt(rotatedAt);
		return Promise.resolve(1);
	}

	public override isActiveSuperAdmin(userId: string): Promise<boolean> {
		return Promise.resolve(userId === ACTOR);
	}
}

let keys: InMemoryKeyRepository;

function service(kms: LocalDevelopmentKeyManagementService): TenantEncryptionService {
	const tenantTx = new TenantTransactionService(createTestPrisma(), new RequestContextService());
	const cedar = createCedarPolicyEvaluator(tenantTx);
	vi.spyOn(cedar, "getActivePolicyVersion").mockResolvedValue(POLICY_VERSION);
	return new TenantEncryptionService(tenantTx, keys, createTenantAuditPort(), cedar, new RequestContextService(), kms);
}

const kekV1 = (): LocalDevelopmentKeyManagementService => new LocalDevelopmentKeyManagementService(1, KEK_V1, new Map());
/** After rotation: v2 is current, v1 retired but still configured. */
const kekV2WithRetiredV1 = (): LocalDevelopmentKeyManagementService => new LocalDevelopmentKeyManagementService(2, KEK_V2, new Map([[1, KEK_V1]]));
/** After the retired key was removed from the configuration. */
const kekV2Only = (): LocalDevelopmentKeyManagementService => new LocalDevelopmentKeyManagementService(2, KEK_V2, new Map());

function onlyRow(): TenantEncryptionKey {
	const [row] = keys.rows;
	if (row === undefined || keys.rows.length !== 1) {
		throw new Error(`expected exactly one key row, found ${String(keys.rows.length)}`);
	}
	return row;
}

describe("TenantEncryptionService", () => {
	beforeEach(() => {
		keys = new InMemoryKeyRepository();
		db.auditRows.length = 0;
		db.operations.length = 0;
	});

	it("creates the first data key wrapped with the current KEK and audits it with the real actor and policy version", async () => {
		const version = await service(kekV1()).ensureTenantKey(ORG, ACTOR);

		expect(version).toBe(1);
		expect(onlyRow().kmsKeyId).toBe(localKekId(1));
		expect(await kekV1().unwrapDataKey(onlyRow())).toHaveLength(AES_256_KEY_BYTES);
		expect(db.auditRows.map((row) => row.data.action)).toEqual([TENANT_KEY_AUDIT_ACTIONS.created]);
		expect(db.auditRows[LIST_SLOT_INDEX.first]?.data).toMatchObject({
			tenantId: ORG,
			actorUserId: ACTOR,
			policyVersion: POLICY_VERSION,
			metadata: { kmsKeyId: localKekId(1), keyVersion: 1 },
		});
	});

	it("keeps data keys wrapped by a retired KEK readable after rotation, and wraps new keys with the current KEK", async () => {
		await service(kekV1()).ensureTenantKey(ORG, ACTOR);
		const dataKey = await kekV1().unwrapDataKey(onlyRow());

		expect(await kekV2WithRetiredV1().unwrapDataKey(onlyRow())).toEqual(dataKey);
		expect(kekV2WithRetiredV1().currentKeyId()).toBe(localKekId(2));
	});

	it("names the missing KEK instead of failing obscurely once a retired key is removed before re-wrap", async () => {
		await service(kekV1()).ensureTenantKey(ORG, ACTOR);
		await expect(kekV2Only().unwrapDataKey(onlyRow())).rejects.toBeInstanceOf(TenantKekUnavailableError);
	});

	it("re-wraps every data key to the current KEK, audited, after which the retired KEK can be removed", async () => {
		await service(kekV1()).ensureTenantKey(ORG, ACTOR);
		const before = onlyRow().wrappedKey;
		const dataKey = await kekV1().unwrapDataKey(onlyRow());

		const summary = await service(kekV2WithRetiredV1()).rewrapToCurrentKek(ACTOR);

		expect(summary).toEqual({ targetKmsKeyId: localKekId(2), rewrapped: 1, concurrentlyUpdated: 0, failures: [] });
		expect(onlyRow()).toMatchObject({ kmsKeyId: localKekId(2) });
		expect(onlyRow().wrappedKey).not.toBe(before);
		expect(onlyRow().rotatedAt).not.toBeNull();
		expect(db.auditRows.at(-1)?.data).toMatchObject({
			action: TENANT_KEY_AUDIT_ACTIONS.rewrapped,
			actorUserId: ACTOR,
			metadata: { fromKmsKeyId: localKekId(1), toKmsKeyId: localKekId(2) },
		});
		expect(await kekV2Only().unwrapDataKey(onlyRow())).toEqual(dataKey);
		// Idempotent: nothing left to re-wrap.
		expect((await service(kekV2Only()).rewrapToCurrentKek(ACTOR)).rewrapped).toBe(0);
	});

	it("reports (never skips silently) a key it cannot unwrap, and refuses a non-SuperAdmin actor", async () => {
		keys.rows.push({
			...LIVE_ROW_FIELDS,
			id: randomUUID(),
			tenantId: ORG,
			keyVersion: 1,
			wrappedKey: formatGcmEnvelope(gcmEncrypt(randomBytes(32), randomBytes(32))),
			kmsKeyId: localKekId(1),
			status: "ACTIVE",
			rotatedAt: null,
			createdAt: BigInt(0),
			updatedAt: BigInt(0),
		});

		const summary = await service(kekV2WithRetiredV1()).rewrapToCurrentKek(ACTOR);

		expect(summary.rewrapped).toBe(0);
		expect(summary.failures).toEqual([expect.objectContaining({ tenantId: ORG, kmsKeyId: localKekId(1) })]);
		await expect(service(kekV2WithRetiredV1()).rewrapToCurrentKek(NOT_SUPERADMIN)).rejects.toBeInstanceOf(TenantKeyMaintenanceActorError);
	});

	it.each([
		["raw KEK bytes", (): Buffer => KEK_V1],
		["sha256 of the configured key text (earliest pilot builds)", (): Buffer => createHash("sha256").update(KEK_V1.toString("base64")).digest()],
	])("unwraps and re-wraps legacy `local:pilot` data keys wrapped with %s", async (_label, legacyKek) => {
		const dataKey = randomBytes(32);
		keys.rows.push({
			...LIVE_ROW_FIELDS,
			id: randomUUID(),
			tenantId: ORG,
			keyVersion: 1,
			wrappedKey: formatGcmEnvelope(gcmEncrypt(legacyKek(), dataKey)),
			kmsKeyId: LEGACY_PILOT_KEK_ID,
			status: "ACTIVE",
			rotatedAt: null,
			createdAt: BigInt(0),
			updatedAt: BigInt(0),
		});

		expect(await kekV1().unwrapDataKey(onlyRow())).toEqual(dataKey);
		expect((await service(kekV1()).rewrapToCurrentKek(ACTOR)).rewrapped).toBe(1);
		expect(onlyRow().kmsKeyId).toBe(localKekId(1));
		expect(await kekV1().unwrapDataKey(onlyRow())).toEqual(dataKey);
	});

	it("creates exactly one data key when two requests race to create the first one", async () => {
		const encryption = service(kekV1());

		const versions = await Promise.all([encryption.ensureTenantKey(ORG, ACTOR), encryption.ensureTenantKey(ORG, ACTOR)]);

		expect(versions).toEqual([1, 1]);
		expect(keys.rows).toHaveLength(1);
		expect(db.auditRows.filter((row) => row.data.action === TENANT_KEY_AUDIT_ACTIONS.created)).toHaveLength(1);
		// Both callers got the surviving key.
		expect(await kekV1().unwrapDataKey(onlyRow())).toHaveLength(AES_256_KEY_BYTES);
	});

	it("counts a key another process re-wrapped meanwhile as concurrently updated", async () => {
		await service(kekV1()).ensureTenantKey(ORG, ACTOR);
		const rotated = service(kekV2WithRetiredV1());
		const swap = vi.spyOn(keys, "swapWrappedKey").mockResolvedValueOnce(0);

		const summary = await rotated.rewrapToCurrentKek(ACTOR);

		expect(swap).toHaveBeenCalledOnce();
		expect(summary).toMatchObject({ rewrapped: 0, concurrentlyUpdated: 1, failures: [] });
		expect(db.auditRows.some((row) => row.data.action === TENANT_KEY_AUDIT_ACTIONS.rewrapped)).toBe(false);
	});
});
