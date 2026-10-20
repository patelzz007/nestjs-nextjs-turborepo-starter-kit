import { describe, expect, it } from "vitest";
import { epochMs, type EpochMs } from "@workspace/shared";

import { FileBindingTargetMissingError, FileDeleted, FileVerdictReached, type FileReferenceSubject } from "../../../files/public-api";
import { BindStoreAssetOnFileVerdict } from "../event-handlers/in-transaction/bind-store-asset-on-file-verdict.in-transaction-handler";
import { ReleaseKybEvidenceOnFileDeleted } from "../event-handlers/in-transaction/release-kyb-evidence-on-file-deleted.in-transaction-handler";
import { ReleaseStoreAssetOnFileDeleted } from "../event-handlers/in-transaction/release-store-asset-on-file-deleted.in-transaction-handler";
import type { TenantAssetSlot, TenantFileBindings, TenantFileScope } from "../ports/tenant-file-bindings.port";
import { KybEvidenceRetentionGuard } from "../services/kyb-evidence-retention.guard";

const FILE_ID = "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const NOW: EpochMs = epochMs(1_800_000_000_000);

/** Tenant file rows in memory: what was bound and released, and which files are KYB evidence. */
class InMemoryTenantFiles implements TenantFileBindings {
	public readonly bound: [string, TenantAssetSlot, string, number][] = [];
	public readonly releasedAssets: [string, string, number][] = [];
	public readonly releasedKyb: [string, string, number][] = [];

	public constructor(private readonly kybEvidence: ReadonlySet<string> = new Set()) {}

	public bindStoreAsset(tenantId: string, slot: TenantAssetSlot, fileId: string, boundAt: number): Promise<void> {
		this.bound.push([tenantId, slot, fileId, boundAt]);
		return Promise.resolve();
	}

	public releaseStoreAsset(fileId: string, deletedBy: string, deletedAt: number): Promise<void> {
		this.releasedAssets.push([fileId, deletedBy, deletedAt]);
		return Promise.resolve();
	}

	public releaseKybEvidence(fileId: string, deletedBy: string, deletedAt: number): Promise<void> {
		this.releasedKyb.push([fileId, deletedBy, deletedAt]);
		return Promise.resolve();
	}

	public isKybEvidence(fileId: string): Promise<boolean> {
		return Promise.resolve(this.kybEvidence.has(fileId));
	}
}

function scope(kybEvidence: readonly string[] = []): { scope: TenantFileScope; files: InMemoryTenantFiles } {
	const files = new InMemoryTenantFiles(new Set(kybEvidence));
	return { scope: { tenantFiles: files }, files };
}

describe("BindStoreAssetOnFileVerdict", () => {
	it("reacts to READY store logos and banners only", () => {
		const handler = new BindStoreAssetOnFileVerdict();

		expect(handler.accepts(new FileVerdictReached(NOW, FILE_ID, "STORE_LOGO", ORG_ID, "user-1", "READY", null))).toBe(true);
		expect(handler.accepts(new FileVerdictReached(NOW, FILE_ID, "STORE_BANNER", ORG_ID, "user-1", "READY", null))).toBe(true);
		expect(handler.accepts(new FileVerdictReached(NOW, FILE_ID, "STORE_LOGO", ORG_ID, "user-1", "QUARANTINED", null))).toBe(false);
		expect(handler.accepts(new FileVerdictReached(NOW, FILE_ID, "MERCHANT_KYB", ORG_ID, "user-1", "READY", null))).toBe(false);
	});

	it("binds a logo to the LOGO slot and a banner to the BANNER slot of its tenant", async () => {
		const { scope: tenantScope, files } = scope();
		const handler = new BindStoreAssetOnFileVerdict();

		await handler.handle(new FileVerdictReached(NOW, FILE_ID, "STORE_LOGO", ORG_ID, "user-1", "READY", null), tenantScope);
		await handler.handle(new FileVerdictReached(NOW, FILE_ID, "STORE_BANNER", ORG_ID, "user-1", "READY", null), tenantScope);

		expect(files.bound).toEqual([
			[ORG_ID, "LOGO", FILE_ID, NOW],
			[ORG_ID, "BANNER", FILE_ID, NOW],
		]);
	});

	it("fails the verdict when the file names no tenant", async () => {
		await expect(
			new BindStoreAssetOnFileVerdict().handle(new FileVerdictReached(NOW, FILE_ID, "STORE_LOGO", null, "user-1", "READY", null), scope().scope),
		).rejects.toBeInstanceOf(FileBindingTargetMissingError);
	});
});

describe("ReleaseStoreAssetOnFileDeleted and ReleaseKybEvidenceOnFileDeleted", () => {
	it("release the rows of their own categories with who and when", async () => {
		const { scope: tenantScope, files } = scope();
		const releaseAsset = new ReleaseStoreAssetOnFileDeleted();
		const releaseKyb = new ReleaseKybEvidenceOnFileDeleted();
		const logoDeleted = new FileDeleted(NOW, FILE_ID, "STORE_LOGO", ORG_ID, "user-1", []);
		const kybDeleted = new FileDeleted(NOW, FILE_ID, "MERCHANT_KYB", ORG_ID, "user-1", []);

		expect(releaseAsset.accepts(kybDeleted)).toBe(false);
		expect(releaseKyb.accepts(logoDeleted)).toBe(false);
		await releaseAsset.handle(logoDeleted, tenantScope);
		await releaseKyb.handle(kybDeleted, tenantScope);

		expect(files.releasedAssets).toEqual([[FILE_ID, "user-1", NOW]]);
		expect(files.releasedKyb).toEqual([[FILE_ID, "user-1", NOW]]);
	});
});

describe("KybEvidenceRetentionGuard", () => {
	it("refuses to delete a file ever linked to a KYB submission, and lets an unsubmitted upload go", async () => {
		const guard = new KybEvidenceRetentionGuard();
		const subject: FileReferenceSubject = { fileId: FILE_ID, category: "MERCHANT_KYB", tenantId: ORG_ID };

		expect(guard.categories).toEqual(["MERCHANT_KYB"]);
		await expect(guard.blockDelete(subject, scope([FILE_ID]).scope)).resolves.toBe("KYB_EVIDENCE");
		await expect(guard.blockDelete(subject, scope().scope)).resolves.toBeNull();
	});
});
