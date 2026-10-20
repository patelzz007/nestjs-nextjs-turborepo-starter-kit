import { describe, expect, it } from "vitest";
import type { AuthorizationRequest, CreateFileUploadUrlInput } from "@workspace/shared";

import { AuthorizationError } from "../../../../platform/application/errors/app-error";
import type { FileAccessSubject, FileActor } from "../../../files/public-api";
import { ProductImageFileAccessRule, type KernelAuthorizeCheck } from "../product-image-file-access.rule";

const ACTOR: FileActor = { userId: "user-1", isSuperAdmin: false };
const UPLOAD: CreateFileUploadUrlInput = { category: "PRODUCT_IMAGE", fileName: "p.png", mimeType: "image/png", sizeBytes: 10, checksumSha256: "a".repeat(64) };
const IMAGE: FileAccessSubject = { id: "file-1", category: "PRODUCT_IMAGE", uploadedById: "user-1", tenantId: null, productId: "p-1" };

/** Records kernel checks and denies when told to. */
class RecordingKernel implements KernelAuthorizeCheck {
	public readonly requests: AuthorizationRequest[] = [];

	public constructor(private readonly denies = false) {}

	public authorize(request: AuthorizationRequest): Promise<void> {
		this.requests.push(request);
		return this.denies ? Promise.reject(new AuthorizationError({ code: "PERMISSION_DENIED", message: "denied" })) : Promise.resolve();
	}
}

describe("ProductImageFileAccessRule", () => {
	it("requires PRODUCT:UPDATE on the product the image is for", async () => {
		const kernel = new RecordingKernel();

		await new ProductImageFileAccessRule(kernel).assertCanUpload(ACTOR, { ...UPLOAD, productId: "p-1" });

		expect(kernel.requests).toEqual([{ subject: { userId: "user-1", isSuperAdmin: false }, action: "UPDATE", resource: "PRODUCT", resourceId: "p-1" }]);
	});

	it("refuses an upload that names no product, before asking the kernel", async () => {
		const kernel = new RecordingKernel();

		await expect(new ProductImageFileAccessRule(kernel).assertCanUpload(ACTOR, UPLOAD)).rejects.toMatchObject({ code: "FILE_UPLOAD_FORBIDDEN" });
		expect(kernel.requests).toEqual([]);
	});

	it("propagates the kernel's denial", async () => {
		await expect(new ProductImageFileAccessRule(new RecordingKernel(true)).assertCanUpload(ACTOR, { ...UPLOAD, productId: "p-1" })).rejects.toMatchObject({
			code: "PERMISSION_DENIED",
		});
	});

	it("lets only the uploader act on the image afterwards", async () => {
		const rule = new ProductImageFileAccessRule(new RecordingKernel());

		await expect(rule.assertCanAct(ACTOR, IMAGE, "read")).resolves.toBeUndefined();
		await expect(rule.assertCanAct({ userId: "user-2", isSuperAdmin: false }, IMAGE, "delete")).rejects.toMatchObject({ code: "FILE_DELETE_FORBIDDEN" });
	});
});
