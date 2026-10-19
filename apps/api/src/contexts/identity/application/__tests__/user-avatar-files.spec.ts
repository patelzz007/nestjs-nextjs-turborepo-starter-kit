import { describe, expect, it } from "vitest";
import { epochMs, type CreateFileUploadUrlInput, type EpochMs } from "@workspace/shared";

import { FileDeleted, FileVerdictReached, type FileAccessSubject, type FileActor } from "../../../files/public-api";
import { BindUserAvatarOnFileVerdict } from "../event-handlers/in-transaction/bind-user-avatar-on-file-verdict.in-transaction-handler";
import { ReleaseUserAvatarOnFileDeleted } from "../event-handlers/in-transaction/release-user-avatar-on-file-deleted.in-transaction-handler";
import type { UserAvatarBindings, UserAvatarFileScope } from "../ports/user-avatar-bindings.port";
import { UserAvatarFileAccessRule } from "../services/user-avatar-file-access.rule";

const FILE_ID = "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a";
const NOW: EpochMs = epochMs(1_800_000_000_000);
const ACTOR: FileActor = { userId: "user-1", isSuperAdmin: false };
const UPLOAD: Omit<CreateFileUploadUrlInput, "userId"> = { category: "USER_AVATAR", fileName: "me.png", mimeType: "image/png", sizeBytes: 10, checksumSha256: "a".repeat(64) };
const AVATAR: FileAccessSubject = { id: FILE_ID, category: "USER_AVATAR", uploadedById: "user-1", organizationId: null, productId: null };

/** Avatar rows in memory: what was bound and released. */
class InMemoryAvatars implements UserAvatarBindings {
	public readonly bound: [string, string, number][] = [];
	public readonly released: [string, string, number][] = [];

	public bindReadyAvatar(userId: string, fileId: string, boundAt: number): Promise<void> {
		this.bound.push([userId, fileId, boundAt]);
		return Promise.resolve();
	}

	public releaseFile(fileId: string, deletedBy: string, deletedAt: number): Promise<void> {
		this.released.push([fileId, deletedBy, deletedAt]);
		return Promise.resolve();
	}
}

function scope(): { scope: UserAvatarFileScope; avatars: InMemoryAvatars } {
	const avatars = new InMemoryAvatars();
	return { scope: { avatars }, avatars };
}

describe("UserAvatarFileAccessRule", () => {
	it("allows only your own avatar upload", async () => {
		const rule = new UserAvatarFileAccessRule();

		await expect(rule.assertCanUpload(ACTOR, { ...UPLOAD, userId: "user-1" })).resolves.toBeUndefined();
		await expect(rule.assertCanUpload(ACTOR, { ...UPLOAD, userId: "user-2" })).rejects.toMatchObject({ code: "FILE_UPLOAD_FORBIDDEN" });
		await expect(rule.assertCanUpload(ACTOR, UPLOAD)).rejects.toMatchObject({ code: "FILE_UPLOAD_FORBIDDEN" });
	});

	it("lets only the uploader complete, read or delete the avatar afterwards", async () => {
		const rule = new UserAvatarFileAccessRule();
		const someoneElse: FileActor = { userId: "user-2", isSuperAdmin: false };

		await expect(rule.assertCanAct(ACTOR, AVATAR, "read")).resolves.toBeUndefined();
		await expect(rule.assertCanAct(someoneElse, AVATAR, "read")).rejects.toMatchObject({ code: "FILE_VIEW_FORBIDDEN" });
		await expect(rule.assertCanAct(someoneElse, AVATAR, "complete")).rejects.toMatchObject({ code: "FILE_UPLOAD_FORBIDDEN" });
		await expect(rule.assertCanAct(someoneElse, AVATAR, "delete")).rejects.toMatchObject({ code: "FILE_DELETE_FORBIDDEN" });
	});
});

describe("BindUserAvatarOnFileVerdict", () => {
	it("reacts to READY avatars only and binds the file to its uploader", async () => {
		const handler = new BindUserAvatarOnFileVerdict();
		const { scope: avatarScope, avatars } = scope();

		expect(handler.accepts(new FileVerdictReached(NOW, FILE_ID, "USER_AVATAR", null, "user-1", "QUARANTINED", null))).toBe(false);
		expect(handler.accepts(new FileVerdictReached(NOW, FILE_ID, "STORE_LOGO", null, "user-1", "READY", null))).toBe(false);
		const ready = new FileVerdictReached(NOW, FILE_ID, "USER_AVATAR", null, "user-1", "READY", null);
		expect(handler.accepts(ready)).toBe(true);
		await handler.handle(ready, avatarScope);

		expect(avatars.bound).toEqual([["user-1", FILE_ID, NOW]]);
	});
});

describe("ReleaseUserAvatarOnFileDeleted", () => {
	it("releases a deleted avatar file with who and when, and ignores other categories", async () => {
		const handler = new ReleaseUserAvatarOnFileDeleted();
		const { scope: avatarScope, avatars } = scope();

		expect(handler.accepts(new FileDeleted(NOW, FILE_ID, "PRODUCT_IMAGE", null, "user-1", []))).toBe(false);
		await handler.handle(new FileDeleted(NOW, FILE_ID, "USER_AVATAR", null, "user-1", []), avatarScope);

		expect(avatars.released).toEqual([[FILE_ID, "user-1", NOW]]);
	});
});
