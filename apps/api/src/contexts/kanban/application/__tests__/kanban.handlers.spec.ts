import {
	KANBAN_TASK_ATTACHMENT_LIMIT,
	epochMs,
	type CreateKanbanTaskInput,
	type KanbanAttachment,
	type KanbanCommentListQuery,
	type PaginatedServiceResult,
	type KanbanComment,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import type { ActorContext } from "../../../../platform/application/actor-context";
import type { BindableFile } from "../../../files/public-api";
import { AuthenticationError } from "../../../../platform/application/errors/app-error";
import {
	KanbanAttachmentFileInvalidError,
	KanbanAttachmentLimitReachedError,
	KanbanAttachmentNotFoundError,
	KanbanColumnNotFoundError,
	KanbanColumnStaleError,
	KanbanMoveAnchorInvalidError,
	KanbanTaskNotFoundError,
	KanbanTaskStaleError,
} from "../../domain/errors/kanban.errors";
import { AddKanbanCommentCommand } from "../commands/add-kanban-comment/add-kanban-comment.command";
import { AddKanbanCommentHandler } from "../commands/add-kanban-comment/add-kanban-comment.handler";
import { AttachKanbanFileCommand } from "../commands/attach-kanban-file/attach-kanban-file.command";
import { AttachKanbanFileHandler } from "../commands/attach-kanban-file/attach-kanban-file.handler";
import { CreateKanbanTaskCommand } from "../commands/create-kanban-task/create-kanban-task.command";
import { CreateKanbanTaskHandler } from "../commands/create-kanban-task/create-kanban-task.handler";
import { DeleteKanbanTaskCommand } from "../commands/delete-kanban-task/delete-kanban-task.command";
import { DeleteKanbanTaskHandler } from "../commands/delete-kanban-task/delete-kanban-task.handler";
import { ImportKanbanTasksCommand } from "../commands/import-kanban-tasks/import-kanban-tasks.command";
import { ImportKanbanTasksHandler } from "../commands/import-kanban-tasks/import-kanban-tasks.handler";
import { MoveKanbanColumnCommand } from "../commands/move-kanban-column/move-kanban-column.command";
import { MoveKanbanColumnHandler } from "../commands/move-kanban-column/move-kanban-column.handler";
import { MoveKanbanTaskCommand } from "../commands/move-kanban-task/move-kanban-task.command";
import { MoveKanbanTaskHandler } from "../commands/move-kanban-task/move-kanban-task.handler";
import { RemoveKanbanAttachmentCommand } from "../commands/remove-kanban-attachment/remove-kanban-attachment.command";
import { RemoveKanbanAttachmentHandler } from "../commands/remove-kanban-attachment/remove-kanban-attachment.handler";
import { ReviseKanbanTaskCommand } from "../commands/revise-kanban-task/revise-kanban-task.command";
import { ReviseKanbanTaskHandler } from "../commands/revise-kanban-task/revise-kanban-task.handler";
import type { KanbanScope } from "../kanban-scope";
import { GetKanbanAttachmentDownloadHandler } from "../queries/get-kanban-attachment-download/get-kanban-attachment-download.handler";
import { GetKanbanAttachmentDownloadQuery } from "../queries/get-kanban-attachment-download/get-kanban-attachment-download.query";
import { GetKanbanBoardHandler } from "../queries/get-kanban-board/get-kanban-board.handler";
import { GetKanbanBoardQuery } from "../queries/get-kanban-board/get-kanban-board.query";
import { GetKanbanTaskHandler } from "../queries/get-kanban-task/get-kanban-task.handler";
import { GetKanbanTaskQuery } from "../queries/get-kanban-task/get-kanban-task.query";
import { ListKanbanCommentsHandler } from "../queries/list-kanban-comments/list-kanban-comments.handler";
import { ListKanbanCommentsQuery } from "../queries/list-kanban-comments/list-kanban-comments.query";
import { FakeKanbanAttachmentFiles, FakeKanbanReads, taskDetail } from "./fakes/kanban-read.fakes";
import {
	DOING_ID,
	FakeKanbanAssignees,
	InMemoryKanbanStore,
	NOW,
	OTHER_STAFF_ID,
	PLAN_ID,
	STAFF_ID,
	SequenceIdGenerator,
	TODO_ID,
	fakeKanbanScope,
} from "./fakes/kanban-scope.fakes";

const NEW_ID = "0199d0c0-0000-7000-8000-0000000000f1";
const FILE_ID = "0199d0c0-0000-7000-8000-0000000000e1";
const ATTACHMENT_ID = "0199d0c0-0000-7000-8000-0000000000e2";
const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

function staff(userId: string = STAFF_ID): ActorContext {
	return { kind: "user", userId, sessionId: "session-1", tenantId: null, isSuperAdmin: false, accessScope: "tenant", impersonatorUserId: null, request: REQUEST };
}

function apiKey(): ActorContext {
	return { kind: "api_key", apiKeyId: "key-1", tenantId: "0199d0c0-0000-7000-8000-0000000000b1", locationId: null, terminalId: null, request: REQUEST };
}

interface Setup {
	readonly store: InMemoryKanbanStore;
	readonly uow: InMemoryUnitOfWork<KanbanScope>;
	readonly reads: FakeKanbanReads;
	readonly files: FakeKanbanAttachmentFiles;
	readonly ids: SequenceIdGenerator;
	readonly assignees: FakeKanbanAssignees;
}

function setup(): Setup {
	const store = new InMemoryKanbanStore();
	return {
		store,
		uow: new InMemoryUnitOfWork(fakeKanbanScope(store)),
		reads: new FakeKanbanReads(),
		files: new FakeKanbanAttachmentFiles(),
		ids: new SequenceIdGenerator([NEW_ID]),
		assignees: new FakeKanbanAssignees(),
	};
}

const CREATE_INPUT: CreateKanbanTaskInput = {
	columnId: TODO_ID,
	type: "STORY",
	title: "Ship the board",
	description: "",
	priority: "MEDIUM",
	team: "BACKEND",
	labels: [],
	parentId: null,
	assigneeId: null,
	startAt: null,
	dueAt: null,
	storyPoints: null,
	progress: 0,
};

/** The attachment view the read model answers after an attach. */
function attachmentView(kind: KanbanAttachment["kind"], mimeType: KanbanAttachment["mimeType"]): KanbanAttachment {
	return {
		id: NEW_ID,
		fileId: FILE_ID,
		commentId: null,
		kind,
		fileName: "plan.pdf",
		mimeType,
		sizeBytes: 10,
		uploadedBy: { id: STAFF_ID, name: "Admin User" },
		createdAt: NOW,
	};
}

/** Files the attach must refuse, each with what makes it ineligible. */
const INELIGIBLE_FILES: readonly (readonly [label: string, file: Partial<BindableFile>])[] = [
	["still scanning", { status: "SCANNING" }],
	["uploaded by someone else", { uploadedById: OTHER_STAFF_ID }],
	["of another category", { category: "USER_AVATAR" }],
];

describe("CreateKanbanTaskHandler", () => {
	it("adds the task at the bottom of its column, owned by the caller, under the board lock and kanban.board.write", async () => {
		const { store, uow, reads, ids, assignees } = setup();
		store.seedTask("a", TODO_ID);
		reads.tasks.set(NEW_ID, taskDetail(NEW_ID));

		const created = await new CreateKanbanTaskHandler(uow, reads, ids, assignees).execute(new CreateKanbanTaskCommand(staff(), CREATE_INPUT));

		expect(created.id).toBe(NEW_ID);
		expect(store.order(TODO_ID)).toEqual(["a", NEW_ID]);
		expect(store.tasks.get(NEW_ID)).toMatchObject({ ownerId: STAFF_ID, position: 1, type: "STORY", fields: { title: "Ship the board" } });
		expect(store.watchers).toMatchObject([{ taskId: NEW_ID, userId: STAFF_ID, isDeleted: false }]);
		expect(store.history()).toEqual([`${NEW_ID} CREATED ∅→To do`]);
		expect(assignees.asked).toEqual([]);
		expect(store.boardLocks).toBe(1);
		expect(uow.committed).toEqual([{ actor: staff(), operation: "kanban.board.write" }]);
	});

	it("refuses an unknown column and writes nothing", async () => {
		const { store, uow, reads, ids, assignees } = setup();

		await expect(new CreateKanbanTaskHandler(uow, reads, ids, assignees).execute(new CreateKanbanTaskCommand(staff(), { ...CREATE_INPUT, columnId: NEW_ID }))).rejects.toThrow(
			KanbanColumnNotFoundError,
		);
		expect(store.tasks.size).toBe(0);
		expect(uow.rolledBack).toHaveLength(1);
	});

	it("refuses a machine caller before opening a transaction: a task always has an owner", async () => {
		const { uow, reads, ids, assignees } = setup();

		await expect(new CreateKanbanTaskHandler(uow, reads, ids, assignees).execute(new CreateKanbanTaskCommand(apiKey(), CREATE_INPUT))).rejects.toThrow(AuthenticationError);
		expect(uow.committed).toEqual([]);
	});
});

describe("ImportKanbanTasksHandler", () => {
	const SECOND_ID = "0199d0c0-0000-7000-8000-0000000000f2";

	it("adds every task in order at the bottom of its column, owned by the importer, in one transaction", async () => {
		const { store, uow, reads } = setup();
		store.seedTask("a", TODO_ID);

		const board = await new ImportKanbanTasksHandler(uow, reads, new SequenceIdGenerator([NEW_ID, SECOND_ID]), new FakeKanbanAssignees()).execute(
			new ImportKanbanTasksCommand(staff(), { board: "EXECUTION", tasks: [CREATE_INPUT, { ...CREATE_INPUT, columnId: DOING_ID }] }),
		);

		expect(board).toBe(reads.boardView);
		expect(store.order(TODO_ID)).toEqual(["a", NEW_ID]);
		expect(store.order(DOING_ID)).toEqual([SECOND_ID]);
		expect(store.tasks.get(SECOND_ID)?.ownerId).toBe(STAFF_ID);
		expect(store.boardLocks).toBe(1);
		expect(uow.committed).toHaveLength(1);
	});

	it("refuses the whole import when one row names an unknown column", async () => {
		const { store, uow, reads } = setup();

		await expect(
			new ImportKanbanTasksHandler(uow, reads, new SequenceIdGenerator([NEW_ID, SECOND_ID]), new FakeKanbanAssignees()).execute(
				new ImportKanbanTasksCommand(staff(), { board: "EXECUTION", tasks: [CREATE_INPUT, { ...CREATE_INPUT, columnId: SECOND_ID }] }),
			),
		).rejects.toThrow(KanbanColumnNotFoundError);
		expect(store.tasks.size).toBe(0);
	});
});

describe("ReviseKanbanTaskHandler", () => {
	it("applies the edit while the task is still at the version the client read", async () => {
		const { store, uow, reads } = setup();
		store.seedTask("a", TODO_ID, 2);
		reads.tasks.set("a", taskDetail("a", 3));

		const revised = await new ReviseKanbanTaskHandler(uow, reads, new SequenceIdGenerator([]), new FakeKanbanAssignees(), new FixedClock(NOW)).execute(
			new ReviseKanbanTaskCommand(staff(), "a", { version: 2, title: "Renamed", progress: 40 }),
		);

		expect(revised.version).toBe(3);
		expect(store.tasks.get("a")).toMatchObject({ version: 3, fields: { title: "Renamed", progress: 40, team: "BACKEND" } });
	});

	it("answers stale when someone else changed the task first, and not found for a deleted one", async () => {
		const { store, uow, reads } = setup();
		store.seedTask("a", TODO_ID, 5);
		store.seedTask("gone", TODO_ID).isDeleted = true;
		const handler = new ReviseKanbanTaskHandler(uow, reads, new SequenceIdGenerator([]), new FakeKanbanAssignees(), new FixedClock(NOW));

		await expect(handler.execute(new ReviseKanbanTaskCommand(staff(), "a", { version: 4, title: "Mine" }))).rejects.toThrow(KanbanTaskStaleError);
		await expect(handler.execute(new ReviseKanbanTaskCommand(staff(), "gone", { version: 0, title: "Mine" }))).rejects.toThrow(KanbanTaskNotFoundError);
		expect(store.tasks.get("a")?.fields.title).toBe("Write the spec");
	});
});

describe("MoveKanbanTaskHandler", () => {
	it("moves the card under the board lock, consumes its version and answers the whole board", async () => {
		const { store, uow, reads } = setup();
		store.seedTask("a", TODO_ID);
		store.seedTask("b", TODO_ID);
		store.seedTask("c", DOING_ID);

		const board = await new MoveKanbanTaskHandler(uow, reads, new SequenceIdGenerator([])).execute(
			new MoveKanbanTaskCommand(staff(), "a", { columnId: DOING_ID, afterTaskId: "c", version: 0 }),
		);

		expect(board).toBe(reads.boardView);
		expect(store.order(TODO_ID)).toEqual(["b"]);
		expect(store.order(DOING_ID)).toEqual(["c", "a"]);
		expect(store.tasks.get("a")?.version).toBe(1);
		expect(store.tasks.get("b")?.version).toBe(0);
		expect(uow.committed).toEqual([{ actor: staff(), operation: "kanban.board.write" }]);
	});

	it("refuses a move based on a stale read, leaving the board as it was", async () => {
		const { store, uow, reads } = setup();
		store.seedTask("a", TODO_ID, 1);
		store.seedTask("b", TODO_ID);

		await expect(
			new MoveKanbanTaskHandler(uow, reads, new SequenceIdGenerator([])).execute(new MoveKanbanTaskCommand(staff(), "a", { columnId: TODO_ID, afterTaskId: "b", version: 0 })),
		).rejects.toThrow(KanbanTaskStaleError);
		expect(store.order(TODO_ID)).toEqual(["a", "b"]);
		expect(reads.asked).toEqual([]);
	});

	it("refuses an anchor that is not in the target column", async () => {
		const { store, uow, reads } = setup();
		store.seedTask("a", TODO_ID);
		store.seedTask("b", TODO_ID);

		await expect(
			new MoveKanbanTaskHandler(uow, reads, new SequenceIdGenerator([])).execute(
				new MoveKanbanTaskCommand(staff(), "a", { columnId: DOING_ID, afterTaskId: "b", version: 0 }),
			),
		).rejects.toThrow(KanbanMoveAnchorInvalidError);
	});
});

describe("DeleteKanbanTaskHandler", () => {
	it("soft-deletes the task as the caller and closes the gap it leaves", async () => {
		const { store, uow } = setup();
		store.seedTask("a", TODO_ID);
		store.seedTask("b", TODO_ID);
		store.seedTask("c", TODO_ID);

		await new DeleteKanbanTaskHandler(uow, new FixedClock(NOW)).execute(new DeleteKanbanTaskCommand(staff(), "a"));

		expect(store.tasks.get("a")).toMatchObject({ isDeleted: true, deletedBy: STAFF_ID });
		expect(store.liveTasksIn(TODO_ID).map((task) => [task.id, task.position])).toEqual([
			["b", 0],
			["c", 1],
		]);
	});

	it("answers not found for a task that is already gone", async () => {
		const { store, uow } = setup();
		store.seedTask("gone", TODO_ID).isDeleted = true;

		await expect(new DeleteKanbanTaskHandler(uow, new FixedClock(NOW)).execute(new DeleteKanbanTaskCommand(staff(), "gone"))).rejects.toThrow(KanbanTaskNotFoundError);
	});
});

describe("MoveKanbanColumnHandler", () => {
	it("reorders the columns and consumes the moved column's version", async () => {
		const { store, uow, reads } = setup();

		await new MoveKanbanColumnHandler(uow, reads).execute(new MoveKanbanColumnCommand(staff(), TODO_ID, { afterColumnId: DOING_ID, version: 0 }));

		expect(store.columns.map((column) => [column.id, column.position, column.version])).toEqual([
			[TODO_ID, 1, 1],
			[DOING_ID, 0, 0],
			[PLAN_ID, 0, 0],
		]);
	});

	it("refuses a move based on a stale read of the column", async () => {
		const { uow, reads } = setup();

		await expect(new MoveKanbanColumnHandler(uow, reads).execute(new MoveKanbanColumnCommand(staff(), TODO_ID, { afterColumnId: DOING_ID, version: 7 }))).rejects.toThrow(
			KanbanColumnStaleError,
		);
	});
});

describe("AddKanbanCommentHandler", () => {
	it("records the comment as the caller on a live task", async () => {
		const { store, uow, reads, ids } = setup();
		store.seedTask("a", TODO_ID);
		reads.commentViews.set(NEW_ID, { id: NEW_ID, taskId: "a", body: "Looks good", author: { id: STAFF_ID, name: "Admin User" }, attachments: [], createdAt: NOW });

		const comment = await new AddKanbanCommentHandler(uow, reads, ids).execute(new AddKanbanCommentCommand(staff(), "a", { body: "Looks good", fileIds: [] }));

		expect(comment.body).toBe("Looks good");
		expect(store.comments).toEqual([{ id: NEW_ID, taskId: "a", authorId: STAFF_ID, body: "Looks good" }]);
	});

	it("posts the caller's READY files with the comment, as the item's attachments, in one transaction", async () => {
		const { store, uow, reads, ids } = setup();
		store.seedTask("a", TODO_ID);
		store.seedFile({ id: FILE_ID });
		reads.commentViews.set(NEW_ID, { id: NEW_ID, taskId: "a", body: "", author: { id: STAFF_ID, name: "Admin User" }, attachments: [], createdAt: NOW });

		await new AddKanbanCommentHandler(uow, reads, ids).execute(new AddKanbanCommentCommand(staff(), "a", { body: "", fileIds: [FILE_ID] }));

		expect(store.lockedTasks).toEqual(["a"]);
		expect(store.attachments).toMatchObject([{ taskId: "a", commentId: NEW_ID, fileId: FILE_ID, kind: "DOCUMENT" }]);
		expect(store.history()).toEqual(["a COMMENTED ∅→∅", "a ATTACHED ∅→plan.pdf"]);
	});

	it("refuses the whole comment when one of its files is not attachable", async () => {
		const { store, uow, reads, ids } = setup();
		store.seedTask("a", TODO_ID);
		store.seedFile({ id: FILE_ID, status: "SCANNING" });

		await expect(new AddKanbanCommentHandler(uow, reads, ids).execute(new AddKanbanCommentCommand(staff(), "a", { body: "See file", fileIds: [FILE_ID] }))).rejects.toThrow(
			KanbanAttachmentFileInvalidError,
		);
		expect(uow.rolledBack).toHaveLength(1);
	});

	it("refuses a comment on a deleted task", async () => {
		const { store, uow, reads, ids } = setup();
		store.seedTask("gone", TODO_ID).isDeleted = true;

		await expect(new AddKanbanCommentHandler(uow, reads, ids).execute(new AddKanbanCommentCommand(staff(), "gone", { body: "Hello", fileIds: [] }))).rejects.toThrow(
			KanbanTaskNotFoundError,
		);
		expect(store.comments).toEqual([]);
	});
});

describe("AttachKanbanFileHandler", () => {
	function attach(context: Setup): Promise<KanbanAttachment> {
		const { uow, reads, ids } = context;
		return new AttachKanbanFileHandler(uow, reads, ids).execute(new AttachKanbanFileCommand(staff(), "a", { fileId: FILE_ID }));
	}

	it("attaches the caller's READY PDF as a document, with the task row locked", async () => {
		const context = setup();
		context.store.seedTask("a", TODO_ID);
		context.store.seedFile({ id: FILE_ID });
		context.reads.attachmentViews.set(NEW_ID, attachmentView("DOCUMENT", "application/pdf"));

		await expect(attach(context)).resolves.toMatchObject({ id: NEW_ID, kind: "DOCUMENT" });

		expect(context.store.lockedTasks).toEqual(["a"]);
		expect(context.store.attachments).toEqual([{ id: NEW_ID, taskId: "a", commentId: null, fileId: FILE_ID, kind: "DOCUMENT", isDeleted: false }]);
	});

	it("records an image as an attachment", async () => {
		const context = setup();
		context.store.seedTask("a", TODO_ID);
		context.store.seedFile({ id: FILE_ID, mimeType: "image/png", originalName: "screen.png" });
		context.reads.attachmentViews.set(NEW_ID, attachmentView("ATTACHMENT", "image/png"));

		await attach(context);

		expect(context.store.attachments.map((attachment) => attachment.kind)).toEqual(["ATTACHMENT"]);
	});

	it.each(INELIGIBLE_FILES)("refuses a file that is %s", async (_label, file) => {
		const context = setup();
		context.store.seedTask("a", TODO_ID);
		context.store.seedFile({ id: FILE_ID, ...file });

		await expect(attach(context)).rejects.toThrow(KanbanAttachmentFileInvalidError);
		expect(context.store.attachments).toEqual([]);
	});

	it("refuses a file already attached to a task", async () => {
		const context = setup();
		context.store.seedTask("a", TODO_ID);
		context.store.seedFile({ id: FILE_ID });
		context.store.attachments.push({ id: ATTACHMENT_ID, taskId: "other", commentId: null, fileId: FILE_ID, kind: "DOCUMENT", isDeleted: false });

		await expect(attach(context)).rejects.toThrow(KanbanAttachmentFileInvalidError);
	});

	it("refuses a task that already holds the most attachments", async () => {
		const context = setup();
		context.store.seedTask("a", TODO_ID);
		context.store.seedFile({ id: FILE_ID });
		for (let index = 0; index < KANBAN_TASK_ATTACHMENT_LIMIT; index += 1) {
			context.store.attachments.push({
				id: `attachment-${String(index)}`,
				taskId: "a",
				commentId: null,
				fileId: `file-${String(index)}`,
				kind: "ATTACHMENT",
				isDeleted: false,
			});
		}

		await expect(attach(context)).rejects.toThrow(KanbanAttachmentLimitReachedError);
	});

	it("refuses a deleted task", async () => {
		const context = setup();
		context.store.seedTask("a", TODO_ID).isDeleted = true;
		context.store.seedFile({ id: FILE_ID });

		await expect(attach(context)).rejects.toThrow(KanbanTaskNotFoundError);
	});
});

describe("RemoveKanbanAttachmentHandler", () => {
	it("deletes the attached file as the caller (its attachment row is released with it)", async () => {
		const { reads, files } = setup();
		reads.attachedFiles.set(ATTACHMENT_ID, { attachmentId: ATTACHMENT_ID, fileId: FILE_ID, fileName: "plan.pdf", taskId: "a" });
		files.liveFileIds.add(FILE_ID);

		await new RemoveKanbanAttachmentHandler(reads, files).execute(new RemoveKanbanAttachmentCommand(staff(OTHER_STAFF_ID), "a", ATTACHMENT_ID));

		expect(files.deleted).toEqual([{ fileId: FILE_ID, actorUserId: OTHER_STAFF_ID }]);
	});

	it("answers not found for an attachment of another task, or whose file is already gone", async () => {
		const { reads, files } = setup();
		reads.attachedFiles.set(ATTACHMENT_ID, { attachmentId: ATTACHMENT_ID, fileId: FILE_ID, fileName: "plan.pdf", taskId: "a" });
		const handler = new RemoveKanbanAttachmentHandler(reads, files);

		await expect(handler.execute(new RemoveKanbanAttachmentCommand(staff(), "b", ATTACHMENT_ID))).rejects.toThrow(KanbanAttachmentNotFoundError);
		await expect(handler.execute(new RemoveKanbanAttachmentCommand(staff(), "a", ATTACHMENT_ID))).rejects.toThrow(KanbanAttachmentNotFoundError);
		expect(files.deleted).toEqual([]);
	});
});

describe("kanban queries", () => {
	const QUERY: KanbanCommentListQuery = { page: 1, limit: 20 };

	it("answers the board as the caller", async () => {
		const reads = new FakeKanbanReads();

		await expect(new GetKanbanBoardHandler(reads).execute(new GetKanbanBoardQuery(staff(), "PLANNING"))).resolves.toBe(reads.boardView);
		expect(reads.asked).toEqual([{ read: "board:PLANNING", actor: staff() }]);
	});

	it("answers a task, and not found for a missing one", async () => {
		const reads = new FakeKanbanReads();
		reads.tasks.set("a", taskDetail("a"));
		const handler = new GetKanbanTaskHandler(reads);

		await expect(handler.execute(new GetKanbanTaskQuery(staff(), "a"))).resolves.toMatchObject({ id: "a" });
		await expect(handler.execute(new GetKanbanTaskQuery(staff(), "missing"))).rejects.toThrow(KanbanTaskNotFoundError);
	});

	it("answers a page of comments, and not found for a missing task", async () => {
		const reads = new FakeKanbanReads();
		const page: PaginatedServiceResult<KanbanComment> = { items: [], limit: 20, total: 0, page: 1, totalPages: 0, nextCursor: null, hasNext: false, hasPrevious: false };
		reads.commentPages.set("a", page);
		const handler = new ListKanbanCommentsHandler(reads);

		await expect(handler.execute(new ListKanbanCommentsQuery(staff(), "a", QUERY))).resolves.toBe(page);
		await expect(handler.execute(new ListKanbanCommentsQuery(staff(), "missing", QUERY))).rejects.toThrow(KanbanTaskNotFoundError);
	});

	it("signs a download link for a live attachment of the task, named after the upload", async () => {
		const { reads, files } = setup();
		reads.attachedFiles.set(ATTACHMENT_ID, { attachmentId: ATTACHMENT_ID, fileId: FILE_ID, fileName: "plan.pdf", taskId: "a" });
		files.liveFileIds.add(FILE_ID);
		const handler = new GetKanbanAttachmentDownloadHandler(reads, files);

		await expect(handler.execute(new GetKanbanAttachmentDownloadQuery(staff(), "a", ATTACHMENT_ID))).resolves.toEqual({
			attachmentId: ATTACHMENT_ID,
			fileName: "plan.pdf",
			downloadUrl: `https://files.example/${FILE_ID}`,
			expiresAt: epochMs(1_793_000_300_000),
		});
		files.liveFileIds.delete(FILE_ID);
		await expect(handler.execute(new GetKanbanAttachmentDownloadQuery(staff(), "a", ATTACHMENT_ID))).rejects.toThrow(KanbanAttachmentNotFoundError);
		await expect(handler.execute(new GetKanbanAttachmentDownloadQuery(staff(), "b", ATTACHMENT_ID))).rejects.toThrow(KanbanAttachmentNotFoundError);
	});
});
