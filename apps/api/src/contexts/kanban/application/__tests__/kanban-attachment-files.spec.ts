import { epochMs, type AuthorizationRequest, type EpochMs, type FileUploadRequest } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { AuthorizationError } from "../../../../platform/application/errors/app-error";
import { FileDeleted, type FileAccessSubject, type FileActor } from "../../../files/public-api";
import { ReleaseKanbanAttachmentsOnFileDeleted } from "../event-handlers/in-transaction/release-kanban-attachments-on-file-deleted.in-transaction-handler";
import type { KanbanAttachmentBindings, KanbanAttachmentFileScope } from "../ports/kanban-attachment-bindings.port";
import { KanbanAttachmentFileAccessRule, type KernelAuthorizeCheck } from "../services/kanban-attachment-file-access.rule";
import { KanbanAttachmentFileGuard } from "../services/kanban-attachment-file.guard";

const USER_ID = "0199d0c0-0000-7000-8000-000000000001";
const FILE_ID = "0199d0c0-0000-7000-8000-0000000000e1";
const NOW: EpochMs = epochMs(1_793_000_000_000);
const ACTOR: FileActor = { userId: USER_ID, isSuperAdmin: false };
const UPLOAD: FileUploadRequest = {
	category: "KANBAN_TASK_ATTACHMENT",
	fileName: "plan.pdf",
	mimeType: "application/pdf",
	sizeBytes: 10,
	checksumSha256: "a".repeat(64),
	userId: USER_ID,
};
const ATTACHED_FILE: FileAccessSubject = { id: FILE_ID, category: "KANBAN_TASK_ATTACHMENT", uploadedById: USER_ID, tenantId: null, productId: null };

/** Records kernel checks and denies when told to. */
class RecordingKernel implements KernelAuthorizeCheck {
	public readonly requests: AuthorizationRequest[] = [];

	public constructor(private readonly denies = false) {}

	public authorize(request: AuthorizationRequest): Promise<void> {
		this.requests.push(request);
		return this.denies ? Promise.reject(new AuthorizationError({ code: "PERMISSION_DENIED", message: "denied" })) : Promise.resolve();
	}
}

class RecordingBindings implements KanbanAttachmentBindings {
	public readonly released: [string, string, number][] = [];

	public releaseFile(fileId: string, deletedBy: string, deletedAt: number): Promise<void> {
		this.released.push([fileId, deletedBy, deletedAt]);
		return Promise.resolve();
	}
}

describe("KanbanAttachmentFileAccessRule", () => {
	it("lets a staff member upload for themselves with UPDATE:KANBAN_TASK", async () => {
		const kernel = new RecordingKernel();

		await new KanbanAttachmentFileAccessRule(kernel).assertCanUpload(ACTOR, UPLOAD);

		expect(kernel.requests).toEqual([{ subject: { userId: USER_ID, isSuperAdmin: false }, action: "UPDATE", resource: "KANBAN_TASK" }]);
	});

	it("refuses an upload for another user before asking the kernel", async () => {
		const kernel = new RecordingKernel();

		await expect(new KanbanAttachmentFileAccessRule(kernel).assertCanUpload(ACTOR, { ...UPLOAD, userId: "0199d0c0-0000-7000-8000-000000000002" })).rejects.toMatchObject({
			code: "FILE_UPLOAD_FORBIDDEN",
		});
		expect(kernel.requests).toEqual([]);
	});

	it("propagates the kernel's denial", async () => {
		await expect(new KanbanAttachmentFileAccessRule(new RecordingKernel(true)).assertCanUpload(ACTOR, UPLOAD)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
	});

	it("lets only the uploader act on the file through /files", async () => {
		const rule = new KanbanAttachmentFileAccessRule(new RecordingKernel());

		await expect(rule.assertCanAct(ACTOR, ATTACHED_FILE, "complete")).resolves.toBeUndefined();
		await expect(rule.assertCanAct({ userId: "someone-else", isSuperAdmin: false }, ATTACHED_FILE, "read")).rejects.toMatchObject({ code: "FILE_VIEW_FORBIDDEN" });
	});
});

describe("KanbanAttachmentFileGuard", () => {
	it("never blocks a deletion, and runs it as files.delete because attachment rows are bypass-only", async () => {
		const guard = new KanbanAttachmentFileGuard();

		expect(guard.categories).toEqual(["KANBAN_TASK_ATTACHMENT"]);
		expect(guard.deletionScope).toBe("system-operation");
		await expect(guard.blockDelete()).resolves.toBeNull();
	});
});

describe("ReleaseKanbanAttachmentsOnFileDeleted", () => {
	const deleted = (category: FileDeleted["category"]): FileDeleted => new FileDeleted(NOW, FILE_ID, category, null, USER_ID, []);

	it("reacts to deleted task attachments only", () => {
		const handler = new ReleaseKanbanAttachmentsOnFileDeleted();

		expect(handler.accepts(deleted("KANBAN_TASK_ATTACHMENT"))).toBe(true);
		expect(handler.accepts(deleted("PRODUCT_IMAGE"))).toBe(false);
	});

	it("releases the file's attachment rows as the deleting user, at the deletion time", async () => {
		const bindings = new RecordingBindings();
		const scope: KanbanAttachmentFileScope = { attachmentBindings: bindings };

		await new ReleaseKanbanAttachmentsOnFileDeleted().handle(deleted("KANBAN_TASK_ATTACHMENT"), scope);

		expect(bindings.released).toEqual([[FILE_ID, USER_ID, NOW]]);
	});
});
