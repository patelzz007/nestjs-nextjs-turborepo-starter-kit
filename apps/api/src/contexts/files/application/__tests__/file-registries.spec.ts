import type { FileUploadRequest } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { FileCategoryAccessRegistry, FileCategoryAccessUnregisteredError } from "../ports/file-category-access.port";
import { bindFileReferenceGuard, FileReferenceGuardRegistry, type FileReferenceBlock, type FileReferenceGuard, type FileReferenceSubject } from "../ports/file-reference.port";
import { CHECKSUM, FILE_ID, ORG_ID, RecordingAccessRule, UPLOADER_ID, cleanupActor, userActor } from "./fakes/files.fakes";

const KYB: FileUploadRequest = {
	category: "MERCHANT_KYB",
	fileName: "f.pdf",
	mimeType: "application/pdf",
	sizeBytes: 1,
	checksumSha256: CHECKSUM,
	tenantId: ORG_ID,
};
const SUBJECT: FileReferenceSubject = { fileId: FILE_ID, category: "MERCHANT_KYB", tenantId: ORG_ID };

/** A guard over a scope that is just the transaction marker it was bound to. */
class MarkerGuard implements FileReferenceGuard<{ readonly db: string }> {
	public readonly seen: string[] = [];

	public constructor(
		public readonly categories: FileReferenceGuard<{ readonly db: string }>["categories"],
		public readonly deletionScope: FileReferenceGuard<{ readonly db: string }>["deletionScope"],
		private readonly block: FileReferenceBlock | null,
	) {}

	public blockDelete(_subject: FileReferenceSubject, scope: { readonly db: string }): Promise<FileReferenceBlock | null> {
		this.seen.push(scope.db);
		return Promise.resolve(this.block);
	}
}

describe("FileCategoryAccessRegistry", () => {
	it("hands a user's request to the category's owner", async () => {
		const registry = new FileCategoryAccessRegistry();
		const rule = new RecordingAccessRule(["MERCHANT_KYB"]);
		registry.register(rule);

		await registry.assertCanUpload(userActor(), KYB);

		expect(rule.uploads).toEqual([{ actor: { userId: UPLOADER_ID, isSuperAdmin: false }, request: KYB }]);
	});

	it("lets a platform SuperAdmin act in any category without asking the owner", async () => {
		const registry = new FileCategoryAccessRegistry();
		const rule = new RecordingAccessRule(["MERCHANT_KYB"]);
		registry.register(rule);

		await registry.assertCanAct(userActor(UPLOADER_ID, true), { id: FILE_ID, category: "MERCHANT_KYB", uploadedById: "x", tenantId: ORG_ID, productId: null }, "delete");

		expect(rule.acts).toEqual([]);
	});

	it("refuses a non-user caller with the action's code, and fails closed for an unregistered category", async () => {
		const registry = new FileCategoryAccessRegistry();

		await expect(registry.assertCanUpload(cleanupActor(), KYB)).rejects.toMatchObject({ code: "FILE_UPLOAD_FORBIDDEN" });
		await expect(
			registry.assertCanAct(cleanupActor(), { id: FILE_ID, category: "MERCHANT_KYB", uploadedById: "x", tenantId: null, productId: null }, "read"),
		).rejects.toMatchObject({
			code: "FILE_VIEW_FORBIDDEN",
		});
		await expect(registry.assertCanUpload(userActor(), KYB)).rejects.toBeInstanceOf(FileCategoryAccessUnregisteredError);
	});
});

describe("FileReferenceGuardRegistry", () => {
	it("asks only the category's guards, each through its own scope on the same transaction, and returns the first block", async () => {
		const registry = new FileReferenceGuardRegistry<string>();
		const clear = new MarkerGuard(["MERCHANT_KYB"], "actor", null);
		const blocking = new MarkerGuard(["MERCHANT_KYB"], "actor", "KYB_EVIDENCE");
		const other = new MarkerGuard(["REWARD_IMAGE"], "actor", "REWARD_IMAGE");
		const scopes = { create: (db: string): { readonly db: string } => ({ db }) };
		registry.register(bindFileReferenceGuard(clear, scopes));
		registry.register(bindFileReferenceGuard(blocking, scopes));
		registry.register(bindFileReferenceGuard(other, scopes));

		await expect(registry.blockDelete(SUBJECT, "tx-1", new TransactionalEventCollector())).resolves.toBe("KYB_EVIDENCE");
		expect(clear.seen).toEqual(["tx-1"]);
		expect(other.seen).toEqual([]);
	});

	it("runs a deletion as a system operation only when an owner of that category asks for it", () => {
		const registry = new FileReferenceGuardRegistry<string>();
		registry.register(bindFileReferenceGuard(new MarkerGuard(["PRODUCT_IMAGE"], "system-operation", null), { create: (db: string) => ({ db }) }));

		expect(registry.deletionScopeFor("PRODUCT_IMAGE")).toBe("system-operation");
		expect(registry.deletionScopeFor("USER_AVATAR")).toBe("actor");
	});
});
