import { RequestMethod } from "@nestjs/common";
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { CommandBus, CqrsModule, QueryBus } from "@nestjs/cqrs";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { DECORATORS } from "@nestjs/swagger";
import { API_VERSION_PREFIX, IDEMPOTENCY_KEY_HEADER, type PermissionAction, type PermissionResource } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { REQUIRED_PERMISSION_KEY } from "../../../../../platform/presentation/http/security/decorators/route-requirements.metadata";
import { AdminAccessGuard } from "../../../../../platform/presentation/http/security/guards/admin-access.guard";
import { ResponseContract } from "../../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { handlerOf } from "../../../../../../test/support/route-metadata";
import { AddKanbanCommentCommand } from "../../../application/commands/add-kanban-comment/add-kanban-comment.command";
import { DeleteKanbanTaskCommand } from "../../../application/commands/delete-kanban-task/delete-kanban-task.command";
import { MoveKanbanTaskCommand } from "../../../application/commands/move-kanban-task/move-kanban-task.command";
import { RemoveKanbanAttachmentCommand } from "../../../application/commands/remove-kanban-attachment/remove-kanban-attachment.command";
import { WatchKanbanTaskCommand } from "../../../application/commands/watch-kanban-task/watch-kanban-task.command";
import { GetKanbanBoardQuery } from "../../../application/queries/get-kanban-board/get-kanban-board.query";
import { KanbanController } from "../kanban.controller";

const reflector = new Reflector();

/** The key `@RequirePermission` stores its requirement under, named through the decorator itself. */

const TASK_ID = "0199d0c0-0000-7000-8000-0000000000c1";
const ATTACHMENT_ID = "0199d0c0-0000-7000-8000-0000000000e2";
const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };
const ACTOR: ActorContext = {
	kind: "user",
	userId: "0199d0c0-0000-7000-8000-000000000001",
	sessionId: "session-1",
	tenantId: null,
	isSuperAdmin: false,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: REQUEST,
};

type Handler = keyof KanbanController;

/** Each route: handler, path, method, the permission it needs (action, resource), its platform operation, and whether a retry may replay it. */
const ROUTES: readonly (readonly [
	handler: Handler,
	path: string,
	method: RequestMethod,
	action: PermissionAction,
	resource: PermissionResource,
	operation: string,
	idempotent: boolean,
])[] = [
	["board", "board", RequestMethod.GET, "LIST", "KANBAN_TASK", "kanban.board.read", false],
	["people", "people", RequestMethod.GET, "LIST", "KANBAN_TASK", "kanban.board.read", false],
	["items", "items", RequestMethod.GET, "LIST", "KANBAN_TASK", "kanban.board.read", false],
	["createTask", "tasks", RequestMethod.POST, "CREATE", "KANBAN_TASK", "kanban.board.write", true],
	["importTasks", "tasks/import", RequestMethod.POST, "CREATE", "KANBAN_TASK", "kanban.board.write", true],
	["task", "tasks/:taskId", RequestMethod.GET, "READ", "KANBAN_TASK", "kanban.board.read", false],
	["updateTask", "tasks/:taskId", RequestMethod.PATCH, "UPDATE", "KANBAN_TASK", "kanban.board.write", false],
	["deleteTask", "tasks/:taskId", RequestMethod.DELETE, "DELETE", "KANBAN_TASK", "kanban.board.write", false],
	["moveTask", "tasks/:taskId/move", RequestMethod.POST, "UPDATE", "KANBAN_TASK", "kanban.board.write", false],
	["moveColumn", "columns/:columnId/move", RequestMethod.POST, "UPDATE", "KANBAN_BOARD", "kanban.board.write", false],
	["updateColumn", "columns/:columnId", RequestMethod.PATCH, "UPDATE", "KANBAN_BOARD", "kanban.board.write", false],
	["comments", "tasks/:taskId/comments", RequestMethod.GET, "LIST", "KANBAN_TASK", "kanban.board.read", false],
	["addComment", "tasks/:taskId/comments", RequestMethod.POST, "UPDATE", "KANBAN_TASK", "kanban.board.write", true],
	["activity", "tasks/:taskId/activity", RequestMethod.GET, "READ", "KANBAN_TASK", "kanban.board.read", false],
	["addLink", "tasks/:taskId/links", RequestMethod.POST, "UPDATE", "KANBAN_TASK", "kanban.board.write", false],
	["removeLink", "tasks/:taskId/links/:linkId", RequestMethod.DELETE, "UPDATE", "KANBAN_TASK", "kanban.board.write", false],
	["setChecklistItem", "tasks/:taskId/checklist/:itemId", RequestMethod.PATCH, "UPDATE", "KANBAN_TASK", "kanban.board.write", false],
	["watch", "tasks/:taskId/watch", RequestMethod.PUT, "READ", "KANBAN_TASK", "kanban.board.write", false],
	["unwatch", "tasks/:taskId/watch", RequestMethod.DELETE, "READ", "KANBAN_TASK", "kanban.board.write", false],
	["attachFile", "tasks/:taskId/attachments", RequestMethod.POST, "UPDATE", "KANBAN_TASK", "kanban.board.write", true],
	["removeAttachment", "tasks/:taskId/attachments/:attachmentId", RequestMethod.DELETE, "UPDATE", "KANBAN_TASK", "kanban.board.write", false],
	["attachmentDownload", "tasks/:taskId/attachments/:attachmentId/download", RequestMethod.GET, "READ", "KANBAN_TASK", "kanban.board.read", false],
];

describe("KanbanController routes", () => {
	it("serves the board under the versioned /admin/kanban prefix, to admin-panel sessions only", () => {
		expect(reflector.get<string>(PATH_METADATA, KanbanController)).toBe(`${API_VERSION_PREFIX}/admin/kanban`);
		expect(reflector.get<readonly object[]>(GUARDS_METADATA, KanbanController)).toContain(AdminAccessGuard);
	});

	it.each(ROUTES)("routes %s to %s (%s), requiring %s %s under %s", (handler, path, method, action, resource, operation, idempotent) => {
		const target = handlerOf(KanbanController.prototype, handler);

		expect(reflector.get<string>(PATH_METADATA, target)).toBe(path);
		expect(reflector.get<RequestMethod>(METHOD_METADATA, target)).toBe(method);
		expect(reflector.get<readonly object[]>(REQUIRED_PERMISSION_KEY, target)).toEqual([{ action, resource }]);
		expect(reflector.get<string>(PLATFORM_OPERATION_KEY, target)).toBe(operation);
		expect(reflector.get(ResponseContract, target)).toBeDefined();
		// `@Idempotent()` documents the Idempotency-Key header on exactly the routes that honour it.
		const parameters = z.array(z.object({ in: z.string().optional(), name: z.string().optional() }).loose()).parse(reflector.get(DECORATORS.API_PARAMETERS, target) ?? []);
		expect(parameters.some((parameter) => parameter.in === "header" && parameter.name === IDEMPOTENCY_KEY_HEADER)).toBe(idempotent);
	});
});

describe("KanbanController dispatch", () => {
	let close: () => Promise<void> = (): Promise<void> => Promise.resolve();
	let commandBus: CommandBus;
	let queryBus: QueryBus;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [CqrsModule.forRoot()] }).compile();
		commandBus = moduleRef.get(CommandBus);
		queryBus = moduleRef.get(QueryBus);
		close = (): Promise<void> => moduleRef.close();
	});

	afterAll(async () => {
		await close();
	});

	it("reads the board the query names through the query bus as the caller", async () => {
		const execute = vi.spyOn(queryBus, "execute").mockResolvedValueOnce({ board: "PLANNING", columns: [] });

		await expect(new KanbanController(commandBus, queryBus).board(ACTOR, { board: "PLANNING" })).resolves.toEqual({ board: "PLANNING", columns: [] });
		expect(execute).toHaveBeenCalledWith(new GetKanbanBoardQuery(ACTOR, "PLANNING"));
	});

	it("watches and unwatches as the caller, through one command", async () => {
		const execute = vi.spyOn(commandBus, "execute").mockResolvedValue({ id: TASK_ID });
		const kanban = new KanbanController(commandBus, queryBus);

		await kanban.watch(ACTOR, { taskId: TASK_ID });
		await kanban.unwatch(ACTOR, { taskId: TASK_ID });

		expect(execute).toHaveBeenCalledWith(new WatchKanbanTaskCommand(ACTOR, TASK_ID, true));
		expect(execute).toHaveBeenCalledWith(new WatchKanbanTaskCommand(ACTOR, TASK_ID, false));
		execute.mockRestore();
	});

	it("dispatches a move with the path's task and the body's placement", async () => {
		const execute = vi.spyOn(commandBus, "execute").mockResolvedValueOnce({ columns: [] });
		const body = { columnId: "0199d0c0-0000-7000-8000-0000000000a2", afterTaskId: null, version: 3 };

		await new KanbanController(commandBus, queryBus).moveTask(ACTOR, { taskId: TASK_ID }, body);

		expect(execute).toHaveBeenCalledWith(new MoveKanbanTaskCommand(ACTOR, TASK_ID, body));
	});

	it("answers success after a delete or an attachment removal", async () => {
		const execute = vi.spyOn(commandBus, "execute").mockResolvedValue(undefined);
		const kanban = new KanbanController(commandBus, queryBus);

		await expect(kanban.deleteTask(ACTOR, { taskId: TASK_ID })).resolves.toEqual({ success: true });
		await expect(kanban.removeAttachment(ACTOR, { taskId: TASK_ID, attachmentId: ATTACHMENT_ID })).resolves.toEqual({ success: true });
		expect(execute).toHaveBeenCalledWith(new DeleteKanbanTaskCommand(ACTOR, TASK_ID));
		expect(execute).toHaveBeenCalledWith(new RemoveKanbanAttachmentCommand(ACTOR, TASK_ID, ATTACHMENT_ID));
		execute.mockRestore();
	});

	it("comments as the caller on the path's task", async () => {
		const execute = vi.spyOn(commandBus, "execute").mockResolvedValueOnce({ id: "comment-1" });

		await new KanbanController(commandBus, queryBus).addComment(ACTOR, { taskId: TASK_ID }, { body: "Looks good", fileIds: [] });

		expect(execute).toHaveBeenCalledWith(new AddKanbanCommentCommand(ACTOR, TASK_ID, { body: "Looks good", fileIds: [] }));
	});
});
