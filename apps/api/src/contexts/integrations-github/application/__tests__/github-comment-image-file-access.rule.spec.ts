import { describe, expect, it } from "vitest";
import type { AuthorizationRequest, FileUploadRequest, FileCategory } from "@workspace/shared";

import { AuthorizationError } from "../../../../platform/application/errors/app-error";
import type { FileAccessSubject, FileActor } from "../../../files/public-api";
import { GithubCommentImageFileAccessRule, type KernelAuthorizeCheck } from "../services/github-comment-image-file-access.rule";

const ACTOR: FileActor = { userId: "user-1", isSuperAdmin: false };
const UPLOAD: Omit<FileUploadRequest, "userId"> = {
	category: "GITHUB_COMMENT_IMAGE",
	fileName: "shot.png",
	mimeType: "image/png",
	sizeBytes: 10,
	checksumSha256: "a".repeat(64),
};
const CATEGORY: FileCategory = "GITHUB_COMMENT_IMAGE";
const PICTURE: FileAccessSubject = { id: "file-1", category: CATEGORY, uploadedById: "user-1", tenantId: null, productId: null };

/** Records kernel checks and denies when told to. */
class RecordingKernel implements KernelAuthorizeCheck {
	public readonly requests: AuthorizationRequest[] = [];

	public constructor(private readonly denies = false) {}

	public authorize(request: AuthorizationRequest): Promise<void> {
		this.requests.push(request);
		return this.denies ? Promise.reject(new AuthorizationError({ code: "PERMISSION_DENIED", message: "denied" })) : Promise.resolve();
	}
}

describe("GithubCommentImageFileAccessRule", () => {
	it("lets you attach comment images only for yourself, with UPDATE:GITHUB_PULL_REQUEST", async () => {
		const kernel = new RecordingKernel();
		const rule = new GithubCommentImageFileAccessRule(kernel);

		await expect(rule.assertCanUpload(ACTOR, { ...UPLOAD, userId: "user-1" })).resolves.toBeUndefined();
		expect(kernel.requests).toEqual([{ subject: { userId: "user-1", isSuperAdmin: false }, action: "UPDATE", resource: "GITHUB_PULL_REQUEST" }]);
		await expect(rule.assertCanUpload(ACTOR, { ...UPLOAD, userId: "user-2" })).rejects.toMatchObject({ code: "FILE_UPLOAD_FORBIDDEN" });
		expect(kernel.requests).toHaveLength(1);
	});

	it("propagates the kernel's denial", async () => {
		await expect(new GithubCommentImageFileAccessRule(new RecordingKernel(true)).assertCanUpload(ACTOR, { ...UPLOAD, userId: "user-1" })).rejects.toMatchObject({
			code: "PERMISSION_DENIED",
		});
	});

	it("lets only the uploader act on the picture afterwards", async () => {
		const rule = new GithubCommentImageFileAccessRule(new RecordingKernel());

		await expect(rule.assertCanAct(ACTOR, PICTURE, "delete")).resolves.toBeUndefined();
		await expect(rule.assertCanAct({ userId: "user-2", isSuperAdmin: false }, PICTURE, "read")).rejects.toMatchObject({ code: "FILE_VIEW_FORBIDDEN" });
	});
});
