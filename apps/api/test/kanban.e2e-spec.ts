import { createHash, randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
	API_VERSION_PREFIX,
	ApiErrorResponseSchema,
	CreateFileUploadUrlResponseSchema,
	FileDetailResponseSchema,
	KanbanAttachmentDownloadSchema,
	KanbanActivitySchema,
	KanbanAttachmentSchema,
	KanbanBoardSchema,
	KanbanCommentSchema,
	KanbanItemSummarySchema,
	KanbanPeopleSchema,
	KanbanSearchResultsSchema,
	KanbanTaskDetailSchema,
	LIST_SLOT_INDEX,
	type FileStatus,
	type KanbanBoard,
	type KanbanBoardKind,
	type KanbanColumn,
	type KanbanItemType,
	type KanbanTaskDetail,
} from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import {
	createE2eApp,
	login,
	grantSeedUsersFullSession,
	mutationHeaders,
	parsePaginatedEnvelope,
	parseSuccessEnvelope,
	uniqueClientIp,
	type InjectResponse,
	type LoginResult,
} from "./e2e-helpers";
import { countStatements } from "./support/sql-statement-counter";

/**
 * The staff kanban boards end to end on real Postgres: permissions per route,
 * the boards' ordering under the board lock (positions stay contiguous,
 * concurrent moves never collide), optimistic locking, the epic → feature →
 * story → task hierarchy and its rollups, assignees, checklists, links,
 * watchers, WIP limits, history, comments, and an attachment's whole life
 * (upload → attach → download → remove). The spec works in fixture columns of
 * its own — two on the execution board, one on the planning board, placed after
 * the seeded ones — and removes every row it made afterwards.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const KANBAN = `${API_VERSION_PREFIX}/admin/kanban`;
const FILES = `${API_VERSION_PREFIX}/files`;
const ADMIN = { email: "admin@example.com", password: "Admin@123" };
const MANAGER = { email: "manager@example.com", password: "Manager@123" };
const CONSUMER = { email: "user@example.com", password: "User@123" };
/** Far past any seeded column, so the fixtures sit at the right end of the board. */
const FIXTURE_COLUMN_POSITION = 100;
const VERDICT_POLL_ATTEMPTS = 100;
const VERDICT_POLL_INTERVAL_MS = 100;
const TERMINAL_STATUSES: ReadonlySet<FileStatus> = new Set<FileStatus>(["READY", "QUARANTINED", "FAILED"]);
/** The smallest well-formed PDF: its magic bytes pass the upload's type check. */
const PDF_BYTES: Buffer = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n", "latin1");

const TicketSchema = CreateFileUploadUrlResponseSchema.extend({ fields: z.object({ key: z.string(), token: z.string() }).strict() });
type Ticket = z.output<typeof TicketSchema>;

const PositionRowSchema = z.object({ id: z.string(), position: z.number().int() });

/** A JSON request body as the spec sends it. */
type JsonScalar = string | number | boolean | null;
type Payload = Readonly<
	Record<string, JsonScalar | readonly string[] | readonly Readonly<Record<string, JsonScalar>>[] | readonly Readonly<Record<string, JsonScalar | readonly string[]>>[]>
>;

/** Item types deepest first: removing fixture rows children-first never trips a parent's foreign key. */
const CLEANUP_ORDER: readonly KanbanItemType[] = ["SUBTASK", "TASK", "STORY", "FEATURE", "EPIC"];

function sha256(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function cookieOf(session: LoginResult): string {
	return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
}

function multipart(fields: Readonly<Record<string, string>>, bytes: Buffer): { readonly payload: Buffer; readonly contentType: string } {
	const boundary = `----kanban-${randomUUID()}`;
	const parts: Buffer[] = Object.entries(fields).map(([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
	parts.push(
		Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="plan.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
		bytes,
		Buffer.from(`\r\n--${boundary}--\r\n`),
	);
	return { payload: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

function pathOf(url: string): string {
	const parsed = new URL(url);
	return `${parsed.pathname}${parsed.search}`;
}

describe("Kanban board (e2e, real Postgres)", () => {
	const marker = `kanban-e2e-${randomUUID().slice(0, 8)}`;
	const columnA = randomUUID();
	const columnB = randomUUID();
	const columnP = randomUUID();
	const createdTaskIds: string[] = [];
	const uploadedFileIds: string[] = [];
	let app: NestFastifyApplication;
	let pool: Pool;
	let admin: LoginResult;
	let manager: LoginResult;
	let consumer: LoginResult;
	let adminId = "";

	/** Every request comes from its own synthetic client so the per-IP rate limit never interferes. */
	function send(options: {
		readonly method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
		readonly url: string;
		readonly session?: LoginResult;
		readonly payload?: Payload | Buffer;
		readonly headers?: Readonly<Record<string, string>>;
	}): Promise<InjectResponse> {
		const auth: Record<string, string> = options.session === undefined ? {} : { cookie: cookieOf(options.session) };
		const headers = options.method === "GET" ? { ...auth, ...options.headers } : mutationHeaders({ ...auth, ...options.headers });
		return app.inject({
			method: options.method,
			url: options.url,
			headers: { ...headers, "x-forwarded-for": uniqueClientIp() },
			...(options.payload === undefined ? {} : { payload: options.payload }),
		});
	}

	async function board(session: LoginResult = admin, kind: KanbanBoardKind = "EXECUTION"): Promise<KanbanBoard> {
		const response = await send({ method: "GET", url: `${KANBAN}/board?board=${kind}`, session });
		expect(response.statusCode, response.body).toBe(200);
		return parseSuccessEnvelope(response, KanbanBoardSchema).data;
	}

	function columnOf(view: KanbanBoard, columnId: string): KanbanColumn {
		const column = view.columns.find((candidate) => candidate.id === columnId);
		if (column === undefined) {
			throw new Error(`column ${columnId} is not on the board`);
		}
		return column;
	}

	async function order(columnId: string): Promise<string[]> {
		return columnOf(await board(), columnId).tasks.map((task) => task.title);
	}

	/** The live tasks' stored positions of a column, top to bottom. */
	async function storedPositions(columnId: string): Promise<number[]> {
		const result = await pool.query('SELECT id, position FROM public."KanbanTask" WHERE "executionColumnId" = $1 AND "isDeleted" = false ORDER BY position, id', [columnId]);
		return result.rows.map((row) => PositionRowSchema.parse(row).position);
	}

	function createItem(title: string, columnId: string, extra: Payload, session: LoginResult = admin): Promise<InjectResponse> {
		return send({
			method: "POST",
			url: `${KANBAN}/tasks`,
			session,
			payload: { columnId, type: "STORY", title: `${marker} ${title}`, description: "", priority: "MEDIUM", team: "BACKEND", progress: 0, ...extra },
		});
	}

	async function createTask(title: string, columnId: string = columnA, session: LoginResult = admin, extra: Payload = {}): Promise<KanbanTaskDetail> {
		const response = await createItem(title, columnId, extra, session);
		expect(response.statusCode, response.body).toBe(201);
		const task = parseSuccessEnvelope(response, KanbanTaskDetailSchema).data;
		createdTaskIds.push(task.id);
		return task;
	}

	async function detail(taskId: string): Promise<KanbanTaskDetail> {
		const response = await send({ method: "GET", url: `${KANBAN}/tasks/${taskId}`, session: admin });
		expect(response.statusCode, response.body).toBe(200);
		return parseSuccessEnvelope(response, KanbanTaskDetailSchema).data;
	}

	async function currentVersion(taskId: string): Promise<number> {
		const response = await send({ method: "GET", url: `${KANBAN}/tasks/${taskId}`, session: admin });
		return parseSuccessEnvelope(response, KanbanTaskDetailSchema).data.version;
	}

	function move(taskId: string, columnId: string, afterTaskId: string | null, version: number): Promise<InjectResponse> {
		return send({ method: "POST", url: `${KANBAN}/tasks/${taskId}/move`, session: admin, payload: { columnId, afterTaskId, version } });
	}

	async function uploadPdf(): Promise<string> {
		const ticketResponse = await send({
			method: "POST",
			url: `${FILES}/upload-url`,
			session: admin,
			payload: {
				category: "KANBAN_TASK_ATTACHMENT",
				userId: adminId,
				fileName: "plan.pdf",
				mimeType: "application/pdf",
				sizeBytes: PDF_BYTES.length,
				checksumSha256: sha256(PDF_BYTES),
			},
		});
		expect(ticketResponse.statusCode, ticketResponse.body).toBe(201);
		const ticket: Ticket = TicketSchema.parse(parseSuccessEnvelope(ticketResponse, CreateFileUploadUrlResponseSchema).data);
		uploadedFileIds.push(ticket.fileId);
		const body = multipart(ticket.fields, PDF_BYTES);
		const uploaded = await app.inject({
			method: "POST",
			url: pathOf(ticket.uploadUrl),
			headers: { "content-type": body.contentType, "x-forwarded-for": uniqueClientIp() },
			payload: body.payload,
		});
		expect(uploaded.statusCode, uploaded.body).toBeLessThan(300);
		const completed = await send({ method: "POST", url: `${FILES}/${ticket.fileId}/complete`, session: admin, payload: { checksumSha256: sha256(PDF_BYTES) } });
		expect(completed.statusCode, completed.body).toBe(201);
		expect(await awaitVerdict(ticket.fileId)).toBe("READY");
		return ticket.fileId;
	}

	async function awaitVerdict(fileId: string): Promise<FileStatus> {
		for (let attempt = 0; attempt < VERDICT_POLL_ATTEMPTS; attempt += 1) {
			const response = await send({ method: "GET", url: `${FILES}/${fileId}`, session: admin });
			const status = parseSuccessEnvelope(response, FileDetailResponseSchema).data.file.status;
			if (TERMINAL_STATUSES.has(status)) {
				return status;
			}
			await new Promise<void>((resolve: () => void): void => {
				setTimeout(resolve, VERDICT_POLL_INTERVAL_MS);
			});
		}
		throw new Error(`File ${fileId} never left SCANNING`);
	}

	function errorCode(response: InjectResponse): string {
		return ApiErrorResponseSchema.parse(response.json()).error.code;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		// Full sessions for everyone the spec signs in as: the admin panel's routes need a verified
		// email (the seed leaves the manager unverified) and an MFA enrollment that is not yet due.
		await grantSeedUsersFullSession(pool, [ADMIN.email, MANAGER.email, CONSUMER.email]);
		admin = await login(app, ADMIN.email, ADMIN.password);
		manager = await login(app, MANAGER.email, MANAGER.password);
		consumer = await login(app, CONSUMER.email, CONSUMER.password);
		const result = await pool.query('SELECT id FROM public."User" WHERE email = $1', [ADMIN.email]);
		adminId = z.object({ id: z.string() }).parse(result.rows.at(0)).id;
		await pool.query(`INSERT INTO public."KanbanExecutionColumn" (id, title, state, position) VALUES ($1, $2, 'TODO', $3), ($4, $5, 'DONE', $6)`, [
			columnA,
			`${marker} A`,
			FIXTURE_COLUMN_POSITION,
			columnB,
			`${marker} B`,
			FIXTURE_COLUMN_POSITION + 1,
		]);
		await pool.query(`INSERT INTO public."KanbanPlanningColumn" (id, title, stage, position) VALUES ($1, $2, 'BACKLOG', $3)`, [
			columnP,
			`${marker} P`,
			FIXTURE_COLUMN_POSITION,
		]);
	});

	afterAll(async () => {
		await pool.query('DELETE FROM public."KanbanTaskAttachment" WHERE "taskId" = ANY($1::text[])', [createdTaskIds]);
		await pool.query('DELETE FROM public."KanbanTaskComment" WHERE "taskId" = ANY($1::text[])', [createdTaskIds]);
		await pool.query('DELETE FROM public."KanbanTaskActivity" WHERE "taskId" = ANY($1::text[])', [createdTaskIds]);
		await pool.query('DELETE FROM public."KanbanTaskWatcher" WHERE "taskId" = ANY($1::text[])', [createdTaskIds]);
		await pool.query('DELETE FROM public."KanbanChecklistItem" WHERE "taskId" = ANY($1::text[])', [createdTaskIds]);
		await pool.query('DELETE FROM public."KanbanTaskLink" WHERE "sourceTaskId" = ANY($1::text[]) OR "targetTaskId" = ANY($1::text[])', [createdTaskIds]);
		for (const type of CLEANUP_ORDER) {
			await pool.query('DELETE FROM public."KanbanTask" WHERE id = ANY($1::text[]) AND type = $2', [createdTaskIds, type]);
		}
		await pool.query('DELETE FROM public."KanbanExecutionColumn" WHERE id = ANY($1::text[])', [[columnA, columnB]]);
		await pool.query('DELETE FROM public."KanbanPlanningColumn" WHERE id = $1', [columnP]);
		await pool.query('DELETE FROM public."FileVariant" WHERE "fileId" = ANY($1::text[])', [uploadedFileIds]);
		await pool.query('DELETE FROM public."StoredFile" WHERE id = ANY($1::text[])', [uploadedFileIds]);
		await pool.end();
		await app.close();
	});

	describe("authorization", () => {
		it("answers 401 without a session and 403 to a signed-in customer", async () => {
			expect((await send({ method: "GET", url: `${KANBAN}/board?board=EXECUTION` })).statusCode).toBe(401);
			expect((await send({ method: "GET", url: `${KANBAN}/board?board=EXECUTION`, session: consumer })).statusCode).toBe(403);
		});

		it("lets a manager work the board but neither delete a task nor rearrange columns", async () => {
			const task = await createTask("manager task", columnA, manager);

			expect((await send({ method: "DELETE", url: `${KANBAN}/tasks/${task.id}`, session: manager })).statusCode).toBe(403);
			expect((await send({ method: "POST", url: `${KANBAN}/columns/${columnB}/move`, session: manager, payload: { afterColumnId: null, version: 0 } })).statusCode).toBe(403);
			expect((await send({ method: "DELETE", url: `${KANBAN}/tasks/${task.id}`, session: admin })).statusCode).toBe(200);
		});

		it("rejects a malformed id with 400 and an unknown task with 404", async () => {
			expect((await send({ method: "GET", url: `${KANBAN}/tasks/not-a-uuid`, session: admin })).statusCode).toBe(400);
			const missing = await send({ method: "GET", url: `${KANBAN}/tasks/${randomUUID()}`, session: admin });
			expect(missing.statusCode).toBe(404);
			expect(errorCode(missing)).toBe("KANBAN_TASK_NOT_FOUND");
		});
	});

	describe("ordering", () => {
		it("adds tasks at the bottom of their column, owned by their creator", async () => {
			const first = await createTask("first");
			await createTask("second");
			await createTask("third");

			expect(first.owner.id).toBe(adminId);
			expect(first.column.id).toBe(columnA);
			expect(await order(columnA)).toEqual([`${marker} first`, `${marker} second`, `${marker} third`]);
			expect(await storedPositions(columnA)).toEqual([0, 1, 2]);
		});

		it("moves a task within its column and across columns, keeping positions contiguous", async () => {
			const [first, , third] = columnOf(await board(), columnA).tasks;
			if (first === undefined || third === undefined) {
				throw new Error("the ordering fixture is missing");
			}

			const within = await move(first.id, columnA, third.id, first.version);
			expect(within.statusCode, within.body).toBe(201);
			expect(columnOf(parseSuccessEnvelope(within, KanbanBoardSchema).data, columnA).tasks.map((task) => task.title)).toEqual([
				`${marker} second`,
				`${marker} third`,
				`${marker} first`,
			]);

			const across = await move(first.id, columnB, null, await currentVersion(first.id));
			expect(across.statusCode, across.body).toBe(201);
			expect(await order(columnA)).toEqual([`${marker} second`, `${marker} third`]);
			expect(await order(columnB)).toEqual([`${marker} first`]);
			expect(await storedPositions(columnA)).toEqual([0, 1]);
			expect(await storedPositions(columnB)).toEqual([0]);
		});

		it("refuses a move based on a stale read with 409 KANBAN_TASK_STALE", async () => {
			const [second] = columnOf(await board(), columnA).tasks;
			if (second === undefined) {
				throw new Error("the ordering fixture is missing");
			}
			expect((await move(second.id, columnA, null, second.version)).statusCode).toBe(201);

			const stale = await move(second.id, columnB, null, second.version);
			expect(stale.statusCode).toBe(409);
			expect(errorCode(stale)).toBe("KANBAN_TASK_STALE");
		});

		it("runs two concurrent moves into one column one after the other: no two tasks ever share a place", async () => {
			const left = await createTask("race left");
			const right = await createTask("race right");

			const responses = await Promise.all([move(left.id, columnB, null, left.version), move(right.id, columnB, null, right.version)]);

			expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
			const positions = await storedPositions(columnB);
			expect(positions).toEqual(positions.map((_, index) => index));
			expect(await order(columnB)).toEqual(expect.arrayContaining([`${marker} race left`, `${marker} race right`, `${marker} first`]));
		});

		it("deletes a task softly and closes the gap it leaves", async () => {
			const [top] = columnOf(await board(), columnB).tasks;
			if (top === undefined) {
				throw new Error("the ordering fixture is missing");
			}

			expect((await send({ method: "DELETE", url: `${KANBAN}/tasks/${top.id}`, session: admin })).statusCode).toBe(200);

			const deleted = await pool.query('SELECT "isDeleted", "deletedBy" FROM public."KanbanTask" WHERE id = $1', [top.id]);
			expect(deleted.rows.at(0)).toEqual({ isDeleted: true, deletedBy: adminId });
			const positions = await storedPositions(columnB);
			expect(positions).toEqual(positions.map((_, index) => index));
			expect((await send({ method: "GET", url: `${KANBAN}/tasks/${top.id}`, session: admin })).statusCode).toBe(404);
		});

		it("reorders the columns, and refuses a stale column move", async () => {
			const before = columnOf(await board(), columnB);
			const seededColumns = (await board()).columns.filter((column) => column.id !== columnA && column.id !== columnB);
			const lastSeeded = seededColumns.at(seededColumns.length - 1);
			if (lastSeeded === undefined) {
				throw new Error("the board has no seeded column");
			}

			const moved = await send({
				method: "POST",
				url: `${KANBAN}/columns/${columnB}/move`,
				session: admin,
				payload: { afterColumnId: lastSeeded.id, version: before.version },
			});
			expect(moved.statusCode, moved.body).toBe(201);
			const ids = parseSuccessEnvelope(moved, KanbanBoardSchema).data.columns.map((column) => column.id);
			expect(ids.indexOf(columnB)).toBe(ids.indexOf(columnA) - 1);

			const stale = await send({ method: "POST", url: `${KANBAN}/columns/${columnB}/move`, session: admin, payload: { afterColumnId: columnA, version: before.version } });
			expect(stale.statusCode).toBe(409);
			expect(errorCode(stale)).toBe("KANBAN_COLUMN_STALE");
		});
	});

	describe("import", () => {
		it("imports several tasks in order, all or none", async () => {
			const row = (title: string): Record<string, string | number | null> => ({
				columnId: columnA,
				type: "STORY",
				title: `${marker} ${title}`,
				description: "",
				priority: "LOW",
				team: "QA",
				dueAt: null,
				progress: 0,
			});
			const imported = await app.inject({
				method: "POST",
				url: `${KANBAN}/tasks/import`,
				headers: { ...mutationHeaders({ cookie: cookieOf(admin) }), "x-forwarded-for": uniqueClientIp() },
				payload: { board: "EXECUTION", tasks: [row("imported one"), row("imported two")] },
			});
			expect(imported.statusCode, imported.body).toBe(201);
			const tasks = columnOf(parseSuccessEnvelope(imported, KanbanBoardSchema).data, columnA).tasks;
			createdTaskIds.push(...tasks.map((task) => task.id));
			expect(tasks.map((task) => task.title).slice(-2)).toEqual([`${marker} imported one`, `${marker} imported two`]);

			const refused = await app.inject({
				method: "POST",
				url: `${KANBAN}/tasks/import`,
				headers: { ...mutationHeaders({ cookie: cookieOf(admin) }), "x-forwarded-for": uniqueClientIp() },
				payload: { board: "EXECUTION", tasks: [row("never"), { ...row("never either"), columnId: randomUUID() }] },
			});
			expect(refused.statusCode).toBe(404);
			expect(await order(columnA)).not.toContain(`${marker} never`);
		});
	});

	describe("editing", () => {
		it("applies an edit based on the current version and refuses a stale one", async () => {
			const task = await createTask("editable");

			const edited = await send({ method: "PATCH", url: `${KANBAN}/tasks/${task.id}`, session: admin, payload: { version: task.version, progress: 40, priority: "HIGH" } });
			expect(edited.statusCode, edited.body).toBe(200);
			expect(parseSuccessEnvelope(edited, KanbanTaskDetailSchema).data).toMatchObject({ progress: 40, priority: "HIGH", version: task.version + 1 });

			const stale = await send({ method: "PATCH", url: `${KANBAN}/tasks/${task.id}`, session: admin, payload: { version: task.version, progress: 90 } });
			expect(stale.statusCode).toBe(409);
			expect(errorCode(stale)).toBe("KANBAN_TASK_STALE");
		});

		it("rejects an out-of-range progress and an unknown field with 400", async () => {
			const task = await createTask("validated");

			expect((await send({ method: "PATCH", url: `${KANBAN}/tasks/${task.id}`, session: admin, payload: { version: task.version, progress: 101 } })).statusCode).toBe(400);
			expect((await send({ method: "PATCH", url: `${KANBAN}/tasks/${task.id}`, session: admin, payload: { version: task.version, ownerId: adminId } })).statusCode).toBe(400);
		});
	});

	describe("comments", () => {
		it("lists a task's comments newest first, and counts them on the card", async () => {
			const task = await createTask("discussed");
			for (const body of ["first thought", "second thought"]) {
				const response = await send({ method: "POST", url: `${KANBAN}/tasks/${task.id}/comments`, session: manager, payload: { body } });
				expect(response.statusCode, response.body).toBe(201);
			}

			const page = await send({ method: "GET", url: `${KANBAN}/tasks/${task.id}/comments?limit=10`, session: admin });
			expect(page.statusCode, page.body).toBe(200);
			expect(parsePaginatedEnvelope(page, KanbanCommentSchema).data.map((comment) => comment.body)).toEqual(["second thought", "first thought"]);
			const card = columnOf(await board(), columnA).tasks.find((candidate) => candidate.id === task.id);
			expect(card?.counts.comments).toBe(2);
		});

		it("refuses a comment on a deleted task", async () => {
			const task = await createTask("doomed");
			await send({ method: "DELETE", url: `${KANBAN}/tasks/${task.id}`, session: admin });

			const response = await send({ method: "POST", url: `${KANBAN}/tasks/${task.id}/comments`, session: admin, payload: { body: "too late" } });
			expect(response.statusCode).toBe(404);
		});
	});

	describe("attachments", () => {
		it("attaches an uploaded PDF as a document, downloads it, and removes it with its file", async () => {
			const task = await createTask("with files");
			const fileId = await uploadPdf();

			const attached = await send({ method: "POST", url: `${KANBAN}/tasks/${task.id}/attachments`, session: admin, payload: { fileId } });
			expect(attached.statusCode, attached.body).toBe(201);
			const attachment = parseSuccessEnvelope(attached, KanbanAttachmentSchema).data;
			expect(attachment).toMatchObject({ fileId, kind: "DOCUMENT", fileName: "plan.pdf", uploadedBy: { id: adminId } });
			expect(columnOf(await board(), columnA).tasks.find((candidate) => candidate.id === task.id)?.counts).toEqual({ comments: 0, attachments: 0, documents: 1 });

			const again = await send({ method: "POST", url: `${KANBAN}/tasks/${task.id}/attachments`, session: admin, payload: { fileId } });
			expect(again.statusCode).toBe(400);
			expect(errorCode(again)).toBe("KANBAN_ATTACHMENT_FILE_INVALID");

			const download = await send({ method: "GET", url: `${KANBAN}/tasks/${task.id}/attachments/${attachment.id}/download`, session: manager });
			expect(download.statusCode, download.body).toBe(200);
			expect(parseSuccessEnvelope(download, KanbanAttachmentDownloadSchema).data.fileName).toBe("plan.pdf");

			const removed = await send({ method: "DELETE", url: `${KANBAN}/tasks/${task.id}/attachments/${attachment.id}`, session: manager });
			expect(removed.statusCode, removed.body).toBe(200);
			const rows = await pool.query(
				'SELECT a."isDeleted" AS "attachmentDeleted", f."isDeleted" AS "fileDeleted" FROM public."KanbanTaskAttachment" a JOIN public."StoredFile" f ON f.id = a."fileId" WHERE a.id = $1',
				[attachment.id],
			);
			expect(rows.rows.at(0)).toEqual({ attachmentDeleted: true, fileDeleted: true });
			expect((await send({ method: "GET", url: `${KANBAN}/tasks/${task.id}/attachments/${attachment.id}/download`, session: admin })).statusCode).toBe(404);
		});

		it("posts files with a comment: they belong to the comment and count as the item's attachments", async () => {
			const task = await createTask("commented with files");
			const fileId = await uploadPdf();

			const posted = await send({ method: "POST", url: `${KANBAN}/tasks/${task.id}/comments`, session: admin, payload: { body: "", fileIds: [fileId] } });
			expect(posted.statusCode, posted.body).toBe(201);
			const comment = parseSuccessEnvelope(posted, KanbanCommentSchema).data;
			expect(comment.attachments.map((attachment) => [attachment.fileId, attachment.commentId, attachment.kind])).toEqual([[fileId, comment.id, "DOCUMENT"]]);

			const page = await send({ method: "GET", url: `${KANBAN}/tasks/${task.id}/comments`, session: manager });
			expect(
				parsePaginatedEnvelope(page, KanbanCommentSchema)
					.data.at(LIST_SLOT_INDEX.first)
					?.attachments.map((attachment) => attachment.fileId),
			).toEqual([fileId]);
			expect((await detail(task.id)).counts.documents).toBe(1);

			const empty = await send({ method: "POST", url: `${KANBAN}/tasks/${task.id}/comments`, session: admin, payload: { body: "  ", fileIds: [] } });
			expect(empty.statusCode).toBe(400);
			const reused = await send({ method: "POST", url: `${KANBAN}/tasks/${task.id}/comments`, session: admin, payload: { body: "again", fileIds: [fileId] } });
			expect(reused.statusCode).toBe(400);
			expect(errorCode(reused)).toBe("KANBAN_ATTACHMENT_FILE_INVALID");
		});

		it("refuses to attach a file that is not the caller's", async () => {
			const task = await createTask("not yours");
			const fileId = await uploadPdf();

			const response = await send({ method: "POST", url: `${KANBAN}/tasks/${task.id}/attachments`, session: manager, payload: { fileId } });
			expect(response.statusCode).toBe(400);
			expect(errorCode(response)).toBe("KANBAN_ATTACHMENT_FILE_INVALID");
		});
	});

	describe("hierarchy", () => {
		it("keeps epics and features on the planning board and stories and tasks on the execution board, each under the level above", async () => {
			const epic = await createTask("epic", columnP, admin, { type: "EPIC" });
			const feature = await createTask("feature", columnP, admin, { type: "FEATURE", parentId: epic.id });
			const story = await createTask("story", columnA, admin, { parentId: feature.id, storyPoints: 5 });
			const task = await createTask("task", columnA, admin, { type: "TASK", parentId: story.id });

			expect(task.ancestors.map((ancestor) => ancestor.id)).toEqual([epic.id, feature.id, story.id]);
			expect((await detail(feature.id)).children.map((child) => child.id)).toEqual([story.id]);

			const misplaced = await createItem("misplaced epic", columnA, { type: "EPIC" });
			expect(misplaced.statusCode).toBe(400);
			expect(errorCode(misplaced)).toBe("KANBAN_BOARD_MISMATCH");
			const wrongParent = await createItem("wrong parent", columnA, { type: "TASK", parentId: feature.id });
			expect(wrongParent.statusCode).toBe(400);
			expect(errorCode(wrongParent)).toBe("KANBAN_PARENT_INVALID");
			expect((await createItem("orphan task", columnA, { type: "TASK" })).statusCode).toBe(400);
			expect((await createItem("estimated feature", columnP, { type: "FEATURE", storyPoints: 3 })).statusCode).toBe(400);

			const occupied = await send({ method: "DELETE", url: `${KANBAN}/tasks/${feature.id}`, session: admin });
			expect(occupied.statusCode).toBe(409);
			expect(errorCode(occupied)).toBe("KANBAN_ITEM_HAS_CHILDREN");

			const move = await send({
				method: "POST",
				url: `${KANBAN}/tasks/${story.id}/move`,
				session: admin,
				payload: { columnId: columnP, afterTaskId: null, version: story.version },
			});
			expect(move.statusCode).toBe(400);
			expect(errorCode(move)).toBe("KANBAN_BOARD_MISMATCH");
		});

		it("rolls a story's points up to its feature and epic, done once the story is done", async () => {
			const epic = await createTask("rollup epic", columnP, admin, { type: "EPIC" });
			const feature = await createTask("rollup feature", columnP, admin, { type: "FEATURE", parentId: epic.id });
			const story = await createTask("rollup story", columnA, admin, { parentId: feature.id, storyPoints: 8 });
			await createTask("rollup story two", columnA, admin, { parentId: feature.id, storyPoints: 3 });

			const planning = columnOf(await board(admin, "PLANNING"), columnP).tasks;
			expect(planning.find((card) => card.id === epic.id)?.rollup).toEqual({ children: { done: 0, total: 1 }, points: { done: 0, total: 11 } });

			expect((await move(story.id, columnB, null, story.version)).statusCode).toBe(201);
			const after = columnOf(await board(admin, "PLANNING"), columnP).tasks;
			expect(after.find((card) => card.id === feature.id)?.rollup).toEqual({ children: { done: 1, total: 2 }, points: { done: 8, total: 11 } });
		});

		it("looks items up by type and title for the pickers", async () => {
			await createTask("picker feature", columnP, admin, { type: "FEATURE" });

			const response = await send({ method: "GET", url: `${KANBAN}/items?filter[type]=FEATURE&search=${encodeURIComponent(`${marker} picker`)}`, session: manager });
			expect(response.statusCode, response.body).toBe(200);
			expect(parsePaginatedEnvelope(response, KanbanItemSummarySchema).data.map((item) => item.title)).toEqual([`${marker} picker feature`]);
		});
	});

	describe("assignees", () => {
		it("offers and accepts the staff who hold the board's permission, and refuses anyone else", async () => {
			const people = await send({ method: "GET", url: `${KANBAN}/people`, session: manager });
			expect(people.statusCode, people.body).toBe(200);
			const ids = parseSuccessEnvelope(people, KanbanPeopleSchema).data.people.map((person) => person.id);
			const managerId = z.object({ id: z.string() }).parse((await pool.query('SELECT id FROM public."User" WHERE email = $1', [MANAGER.email])).rows.at(0)).id;
			const consumerId = z.object({ id: z.string() }).parse((await pool.query('SELECT id FROM public."User" WHERE email = $1', [CONSUMER.email])).rows.at(0)).id;
			expect(ids).toEqual(expect.arrayContaining([adminId, managerId]));
			expect(ids).not.toContain(consumerId);

			const assigned = await createTask("assigned", columnA, admin, { assigneeId: managerId });
			expect(assigned.assignee?.id).toBe(managerId);
			const refused = await createItem("refused", columnA, { assigneeId: consumerId });
			expect(refused.statusCode).toBe(400);
			expect(errorCode(refused)).toBe("KANBAN_ASSIGNEE_INVALID");
		});
	});

	describe("checklists, links, watchers and history", () => {
		it("saves a subtask's steps, ticks a step off, and records both in the history", async () => {
			const story = await createTask("checklist story", columnA);
			const task = await createTask("checklist task", columnA, admin, { type: "TASK", parentId: story.id });
			const subtask = await createTask("checklist subtask", columnA, admin, { type: "SUBTASK", parentId: task.id });
			expect(subtask.key).toMatch(/^SUBTASK-[1-9][0-9]*$/u);
			expect(subtask.ancestors.map((ancestor) => ancestor.id)).toEqual([story.id, task.id]);

			const edited = await send({
				method: "PATCH",
				url: `${KANBAN}/tasks/${subtask.id}`,
				session: admin,
				payload: {
					version: subtask.version,
					steps: [
						{ title: "Design", depth: 0, isDone: false, assigneeId: null },
						{ title: "Schema", depth: 1, isDone: false, assigneeId: adminId },
						{ title: "Index", depth: 0, isDone: false, assigneeId: null },
					],
				},
			});
			expect(edited.statusCode, edited.body).toBe(200);
			const saved = parseSuccessEnvelope(edited, KanbanTaskDetailSchema).data;
			expect(saved.stepItems.map((row) => [row.title, row.depth])).toEqual([
				["Design", 0],
				["Schema", 1],
				["Index", 0],
			]);
			const [design] = saved.stepItems;
			if (design === undefined) {
				throw new Error("the step was not saved");
			}

			const ticked = await send({ method: "PATCH", url: `${KANBAN}/tasks/${subtask.id}/checklist/${design.id}`, session: manager, payload: { isDone: true } });
			expect(ticked.statusCode, ticked.body).toBe(200);
			expect(parseSuccessEnvelope(ticked, KanbanTaskDetailSchema).data).toMatchObject({ steps: { done: 1, total: 3 }, version: saved.version + 1 });
			expect((await detail(task.id)).rollup.children).toEqual({ done: 0, total: 1 });

			const history = await send({ method: "GET", url: `${KANBAN}/tasks/${subtask.id}/activity`, session: admin });
			expect(history.statusCode, history.body).toBe(200);
			expect(parsePaginatedEnvelope(history, KanbanActivitySchema).data.map((entry) => [entry.kind, entry.field, entry.from, entry.to])).toEqual([
				["CHECKED", "STEPS", null, "Design"],
				["UPDATED", "STEPS", "0", "3"],
				["CREATED", null, null, `${marker} A`],
			]);
		});

		it("moves a story to another feature (Move to…), records both parents by key, and undoes it", async () => {
			const epic = await createTask("move epic", columnP, admin, { type: "EPIC" });
			const from = await createTask("move from", columnP, admin, { type: "FEATURE", parentId: epic.id });
			const to = await createTask("move to", columnP, admin, { type: "FEATURE", parentId: epic.id });
			const story = await createTask("moving story", columnA, admin, { parentId: from.id });

			const moved = await send({ method: "POST", url: `${KANBAN}/tasks/${story.id}/parent`, session: manager, payload: { parentId: to.id, version: story.version } });
			expect(moved.statusCode, moved.body).toBe(201);
			const after = parseSuccessEnvelope(moved, KanbanTaskDetailSchema).data;
			expect(after).toMatchObject({ parentId: to.id, columnId: columnA });

			const wrongLevel = await send({ method: "POST", url: `${KANBAN}/tasks/${story.id}/parent`, session: manager, payload: { parentId: epic.id, version: after.version } });
			expect(wrongLevel.statusCode).toBe(400);
			expect(errorCode(wrongLevel)).toBe("KANBAN_PARENT_INVALID");
			const stale = await send({ method: "POST", url: `${KANBAN}/tasks/${story.id}/parent`, session: manager, payload: { parentId: from.id, version: story.version } });
			expect(stale.statusCode).toBe(409);
			const editingParent = await send({ method: "PATCH", url: `${KANBAN}/tasks/${story.id}`, session: admin, payload: { parentId: from.id, version: after.version } });
			expect(editingParent.statusCode).toBe(400);

			const undone = await send({ method: "POST", url: `${KANBAN}/tasks/${story.id}/parent`, session: manager, payload: { parentId: from.id, version: after.version } });
			expect(undone.statusCode, undone.body).toBe(201);
			const history = await send({ method: "GET", url: `${KANBAN}/tasks/${story.id}/activity`, session: admin });
			expect(
				parsePaginatedEnvelope(history, KanbanActivitySchema)
					.data.filter((entry) => entry.field === "PARENT")
					.map((entry) => [entry.from, entry.to]),
			).toEqual([
				[`${to.key ?? ""} ${marker} move to`, `${from.key ?? ""} ${marker} move from`],
				[`${from.key ?? ""} ${marker} move from`, `${to.key ?? ""} ${marker} move to`],
			]);
		});

		it("finds an item by its exact key first, then by key prefix and title, narrowed to one level", async () => {
			const story = await createTask("searchable story", columnA);
			const key = story.key ?? "";

			const exact = await send({ method: "GET", url: `${KANBAN}/search?q=${encodeURIComponent(key.toLowerCase())}`, session: manager });
			expect(exact.statusCode, exact.body).toBe(200);
			const [best] = parseSuccessEnvelope(exact, KanbanSearchResultsSchema).data.results;
			expect(best).toMatchObject({ id: story.id, match: "KEY" });

			const titled = await send({ method: "GET", url: `${KANBAN}/search?q=${encodeURIComponent(`${marker} searchable`)}&type=STORY`, session: manager });
			expect(parseSuccessEnvelope(titled, KanbanSearchResultsSchema).data.results.map((result) => [result.id, result.match])).toEqual([[story.id, "TITLE"]]);
			const otherLevel = await send({ method: "GET", url: `${KANBAN}/search?q=${encodeURIComponent(`${marker} searchable`)}&type=EPIC`, session: manager });
			expect(parseSuccessEnvelope(otherLevel, KanbanSearchResultsSchema).data.results).toEqual([]);
		});

		it("links two items, marks the blocked one, refuses a duplicate and unlinks", async () => {
			const blocker = await createTask("blocker", columnA);
			const blocked = await createTask("blocked", columnA);

			const linked = await send({ method: "POST", url: `${KANBAN}/tasks/${blocked.id}/links`, session: admin, payload: { targetTaskId: blocker.id, kind: "BLOCKED_BY" } });
			expect(linked.statusCode, linked.body).toBe(201);
			const view = parseSuccessEnvelope(linked, KanbanTaskDetailSchema).data;
			expect(view.isBlocked).toBe(true);
			expect(view.links.map((link) => [link.kind, link.item.id])).toEqual([["BLOCKED_BY", blocker.id]]);
			expect((await detail(blocker.id)).links.map((link) => link.kind)).toEqual(["BLOCKS"]);

			const duplicate = await send({ method: "POST", url: `${KANBAN}/tasks/${blocker.id}/links`, session: admin, payload: { targetTaskId: blocked.id, kind: "BLOCKS" } });
			expect(duplicate.statusCode).toBe(409);
			expect(errorCode(duplicate)).toBe("KANBAN_LINK_EXISTS");

			const [link] = view.links;
			if (link === undefined) {
				throw new Error("the link was not saved");
			}
			const unlinked = await send({ method: "DELETE", url: `${KANBAN}/tasks/${blocker.id}/links/${link.id}`, session: admin });
			expect(unlinked.statusCode, unlinked.body).toBe(200);
			expect((await detail(blocked.id)).isBlocked).toBe(false);
		});

		it("lets the reporter stop watching and start again", async () => {
			const item = await createTask("watched", columnA);
			expect(item.isWatching).toBe(true);

			const stopped = await send({ method: "DELETE", url: `${KANBAN}/tasks/${item.id}/watch`, session: admin });
			expect(parseSuccessEnvelope(stopped, KanbanTaskDetailSchema).data.isWatching).toBe(false);
			const again = await send({ method: "PUT", url: `${KANBAN}/tasks/${item.id}/watch`, session: admin });
			expect(parseSuccessEnvelope(again, KanbanTaskDetailSchema).data.watchers.map((person) => person.id)).toEqual([adminId]);
		});

		it("sets a column's WIP limit for an admin only", async () => {
			const column = columnOf(await board(), columnB);

			expect((await send({ method: "PATCH", url: `${KANBAN}/columns/${columnB}`, session: manager, payload: { wipLimit: 2, version: column.version } })).statusCode).toBe(403);
			const limited = await send({ method: "PATCH", url: `${KANBAN}/columns/${columnB}`, session: admin, payload: { wipLimit: 2, version: column.version } });
			expect(limited.statusCode, limited.body).toBe(200);
			expect(columnOf(parseSuccessEnvelope(limited, KanbanBoardSchema).data, columnB)).toMatchObject({ board: "EXECUTION", wipLimit: 2 });

			const planning = columnOf(await board(admin, "PLANNING"), columnP);
			const refused = await send({ method: "PATCH", url: `${KANBAN}/columns/${columnP}`, session: admin, payload: { wipLimit: 2, version: planning.version } });
			expect(refused.statusCode).toBe(400);
			expect(errorCode(refused)).toBe("KANBAN_PLANNING_HAS_NO_WIP_LIMIT");
		});
	});

	describe("performance", () => {
		it("reads the board in the same number of statements whatever its number of cards", async () => {
			const readBoard = async (): Promise<void> => {
				await board();
			};
			const few = await countStatements(pool, readBoard);
			for (let index = 0; index < 5; index += 1) {
				await createTask(`bulk ${String(index)}`);
			}
			const many = await countStatements(pool, readBoard);

			expect(many).toBe(few);
		});
	});
});
