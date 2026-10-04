import { createHash, randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, CreateFileUploadUrlResponseSchema, FileDetailResponseSchema, FileDownloadResponseSchema, type FileStatus } from "@workspace/shared";
import { Pool } from "pg";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LocalTransferTokenService } from "../src/modules/storage/adapters/local/local-transfer-token.service";
import { MALWARE_SCANNER } from "../src/modules/storage/domain/storage.tokens";
import { EICAR_TEST_SIGNATURE, EicarSignatureTestScanner } from "./support/eicar-signature-test-scanner";
import { createE2eApp, login, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

// Runs on the local disk driver (forced for every e2e run by test/setup-env.ts →
// TEST_E2E_STORAGE). The configured scanner is MALWARE_SCANNER=none; this spec
// swaps in the TEST-ONLY EICAR scanner so both verdicts can be exercised.

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const FILES = `${API_VERSION_PREFIX}/files`;
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Admin@123";
/** A queued scan (Redis configured) completes asynchronously: poll this long at most. */
const VERDICT_POLL_ATTEMPTS = 100;
const VERDICT_POLL_INTERVAL_MS = 100;
const TERMINAL_STATUSES: ReadonlySet<FileStatus> = new Set<FileStatus>(["READY", "QUARANTINED", "FAILED"]);

const PNG_BYTES: Buffer = Buffer.from(
	"89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
	"hex",
);
/** Passes the PNG magic-byte check, carries the EICAR test string: only the scanner can catch it. */
const EICAR_PNG_BYTES: Buffer = Buffer.concat([PNG_BYTES, Buffer.from(EICAR_TEST_SIGNATURE, "latin1")]);

const TicketSchema = CreateFileUploadUrlResponseSchema.extend({ fields: z.object({ key: z.string(), token: z.string() }).strict() });
type Ticket = z.output<typeof TicketSchema>;

function sha256(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function multipart(
	fields: Readonly<Record<string, string>>,
	file: { readonly name: string; readonly type: string; readonly bytes: Buffer },
): { payload: Buffer; contentType: string } {
	const boundary = `----ws1-${randomUUID()}`;
	const parts: Buffer[] = Object.entries(fields).map(([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
	parts.push(
		Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`),
		file.bytes,
		Buffer.from(`\r\n--${boundary}--\r\n`),
	);
	return { payload: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

function pathOf(url: string): string {
	const parsed = new URL(url);
	return `${parsed.pathname}${parsed.search}`;
}

describe("File lifecycle on the local driver (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let session: LoginResult;
	let adminId: string;

	/** Every request comes from its own synthetic client so the per-IP rate limit never interferes. */
	async function send(options: {
		method: "GET" | "POST" | "DELETE";
		url: string;
		headers?: Record<string, string>;
		payload?: Buffer | Record<string, string | number>;
	}): Promise<InjectResponse> {
		return app.inject({ ...options, headers: { ...options.headers, "x-forwarded-for": uniqueClientIp() } });
	}

	function cookie(): string {
		return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
	}

	async function createTicket(bytes: Buffer): Promise<Ticket> {
		const response = await send({
			method: "POST",
			url: `${FILES}/upload-url`,
			headers: mutationHeaders({ cookie: cookie() }),
			payload: { category: "USER_AVATAR", userId: adminId, fileName: "avatar.png", mimeType: "image/png", sizeBytes: bytes.length, checksumSha256: sha256(bytes) },
		});
		expect(response.statusCode, response.body).toBe(201);
		return TicketSchema.parse(parseSuccessEnvelope(response, CreateFileUploadUrlResponseSchema).data);
	}

	async function postUpload(ticket: Ticket, bytes: Buffer, fields: Readonly<Record<string, string>> = ticket.fields): Promise<InjectResponse> {
		const body = multipart(fields, { name: "avatar.png", type: "image/png", bytes });
		return send({ method: "POST", url: pathOf(ticket.uploadUrl), headers: { "content-type": body.contentType }, payload: body.payload });
	}

	async function complete(fileId: string, bytes: Buffer): Promise<InjectResponse> {
		return send({ method: "POST", url: `${FILES}/${fileId}/complete`, headers: mutationHeaders({ cookie: cookie() }), payload: { checksumSha256: sha256(bytes) } });
	}

	async function awaitVerdict(fileId: string): Promise<FileStatus> {
		for (let attempt = 0; attempt < VERDICT_POLL_ATTEMPTS; attempt += 1) {
			const response = await send({ method: "GET", url: `${FILES}/${fileId}`, headers: { cookie: cookie() } });
			expect(response.statusCode, response.body).toBe(200);
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

	beforeAll(async () => {
		app = await createE2eApp((builder) => builder.overrideProvider(MALWARE_SCANNER).useValue(new EicarSignatureTestScanner()));
		pool = new Pool({ connectionString: DATABASE_URL });
		session = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD);
		const result = await pool.query<{ id: string }>("SELECT id FROM public.users WHERE email = $1", [ADMIN_EMAIL]);
		adminId = z.string().parse(result.rows.at(0)?.id);
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	describe("GET /files/local-download", () => {
		it("no longer accepts a raw container/path (the old traversal vector to apps/api/.env)", async () => {
			const response = await send({ method: "GET", url: `${FILES}/local-download?container=..&path=..%2F.env` });

			expect(response.statusCode).toBe(400);
			expect(response.body).not.toContain("JWT_");
		});

		it("rejects a forged token", async () => {
			const response = await send({ method: "GET", url: `${FILES}/local-download?token=eyJmYWtlIjp0cnVlfQ.Zm9yZ2Vk` });

			expect(response.statusCode).toBe(403);
		});

		it("rejects an expired token even when it is genuinely signed", async () => {
			const expired = app
				.get(LocalTransferTokenService)
				.signDownload({ fileId: randomUUID(), container: "local-private-bucket", path: "users/x/avatar/x.png", disposition: null, fileName: null }, -1);
			const response = await send({ method: "GET", url: `${FILES}/local-download?token=${encodeURIComponent(expired)}` });

			expect(response.statusCode).toBe(403);
		});

		it("rejects an upload token presented as a download token", async () => {
			const ticket = await createTicket(PNG_BYTES);
			const response = await send({ method: "GET", url: `${FILES}/local-download?token=${encodeURIComponent(ticket.fields.token)}` });

			expect(response.statusCode).toBe(403);
		});
	});

	describe("POST /files/:fileId/local-upload", () => {
		it("404s an unknown file and 403s a token minted for another file", async () => {
			const ticket = await createTicket(PNG_BYTES);
			const other = await createTicket(PNG_BYTES);

			expect((await postUpload({ ...ticket, uploadUrl: ticket.uploadUrl.replace(ticket.fileId, randomUUID()) }, PNG_BYTES)).statusCode).toBe(403);
			expect((await postUpload(ticket, PNG_BYTES, { key: ticket.fields.key, token: other.fields.token })).statusCode).toBe(403);
			expect((await postUpload(ticket, PNG_BYTES, { key: ticket.fields.key, token: "forged.token" })).statusCode).toBe(403);
		});

		it("rejects bytes that differ from the ticket (checksum) or lie about their type (magic bytes)", async () => {
			const html = Buffer.from("<html><script>alert(1)</script></html>");
			const tampered = Buffer.from(PNG_BYTES);
			tampered.writeUInt8(0x00, tampered.length - 1);
			const htmlTicket = await createTicket(html);
			const pngTicket = await createTicket(PNG_BYTES);

			expect((await postUpload(htmlTicket, html)).statusCode).toBe(400);
			expect((await postUpload(pngTicket, tampered)).statusCode).toBe(400);
		});
	});

	it("upload → complete → scan → READY → signed download; the upload cannot be overwritten afterwards", async () => {
		const ticket = await createTicket(PNG_BYTES);

		expect((await postUpload(ticket, PNG_BYTES)).statusCode).toBe(201);
		const completed = await complete(ticket.fileId, PNG_BYTES);
		expect(completed.statusCode, completed.body).toBe(201);
		expect(await awaitVerdict(ticket.fileId)).toBe("READY");
		const detail = await send({ method: "GET", url: `${FILES}/${ticket.fileId}`, headers: { cookie: cookie() } });
		expect(parseSuccessEnvelope(detail, FileDetailResponseSchema).data.file.scanStatus).toBe("CLEAN");
		expect((await complete(ticket.fileId, PNG_BYTES)).statusCode).toBe(409);
		expect((await postUpload(ticket, PNG_BYTES)).statusCode).toBe(409);

		const download = await send({ method: "GET", url: `${FILES}/${ticket.fileId}/download-url`, headers: { cookie: cookie() } });
		const downloadUrl = z.string().parse(parseSuccessEnvelope(download, FileDownloadResponseSchema).data.downloadUrl);
		const bytes = await send({ method: "GET", url: pathOf(downloadUrl) });
		expect(bytes.statusCode).toBe(200);
		expect(bytes.rawPayload.equals(PNG_BYTES)).toBe(true);
		expect(bytes.headers["x-content-type-options"]).toBe("nosniff");
		expect(bytes.headers["content-type"]).toBe("image/png");
		expect(bytes.headers["content-disposition"]).toBe(`inline; filename="avatar.png"; filename*=UTF-8''avatar.png`);
	});

	it("only the scanner decides: an EICAR upload with a valid PNG header is QUARANTINED, never downloadable", async () => {
		const ticket = await createTicket(EICAR_PNG_BYTES);

		expect((await postUpload(ticket, EICAR_PNG_BYTES)).statusCode).toBe(201);
		expect((await complete(ticket.fileId, EICAR_PNG_BYTES)).statusCode).toBe(201);
		expect(await awaitVerdict(ticket.fileId)).toBe("QUARANTINED");

		const download = await send({ method: "GET", url: `${FILES}/${ticket.fileId}/download-url`, headers: { cookie: cookie() } });
		expect(parseSuccessEnvelope(download, FileDownloadResponseSchema).data.downloadUrl).toBeNull();
	});

	it("concurrent completions: exactly one wins", async () => {
		const ticket = await createTicket(PNG_BYTES);
		expect((await postUpload(ticket, PNG_BYTES)).statusCode).toBe(201);

		const statuses = (await Promise.all([complete(ticket.fileId, PNG_BYTES), complete(ticket.fileId, PNG_BYTES), complete(ticket.fileId, PNG_BYTES)])).map(
			(response: InjectResponse): number => response.statusCode,
		);

		expect(statuses.filter((status: number): boolean => status === 201)).toHaveLength(1);
		expect(statuses.filter((status: number): boolean => status === 409)).toHaveLength(2);
		await awaitVerdict(ticket.fileId);
	});

	it("deleting a READY avatar soft-deletes the file and the avatar row with deleted_by", async () => {
		const ticket = await createTicket(PNG_BYTES);
		await postUpload(ticket, PNG_BYTES);
		await complete(ticket.fileId, PNG_BYTES);
		expect(await awaitVerdict(ticket.fileId)).toBe("READY");

		const deleted = await send({ method: "DELETE", url: `${FILES}/${ticket.fileId}`, headers: mutationHeaders({ cookie: cookie() }) });
		expect(deleted.statusCode, deleted.body).toBe(200);

		const file = await pool.query<{ status: string; deletedBy: string | null }>(
			'SELECT status::text AS status, deleted_by AS "deletedBy" FROM public.stored_files WHERE id = $1',
			[ticket.fileId],
		);
		const avatar = await pool.query<{ isDeleted: boolean; deletedBy: string | null }>(
			'SELECT is_deleted AS "isDeleted", deleted_by AS "deletedBy" FROM public.user_avatars WHERE file_id = $1',
			[ticket.fileId],
		);
		expect(file.rows).toEqual([{ status: "DELETED", deletedBy: adminId }]);
		expect(avatar.rows).toEqual([{ isDeleted: true, deletedBy: adminId }]);
	});
});
