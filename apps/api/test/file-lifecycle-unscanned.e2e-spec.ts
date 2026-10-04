import { createHash, randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, CreateFileUploadUrlResponseSchema, FileDetailResponseSchema } from "@workspace/shared";
import { Pool } from "pg";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createE2eApp, login, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

// The app exactly as configured for e2e: local driver, MALWARE_SCANNER=none
// (test/setup-env.ts → TEST_E2E_STORAGE). No scanner exists, so a file must
// become usable but be recorded NOT_SCANNED — never CLEAN.

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const FILES = `${API_VERSION_PREFIX}/files`;
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Admin@123";
const POLL_ATTEMPTS = 100;
const POLL_INTERVAL_MS = 100;
const PNG_BYTES: Buffer = Buffer.from(
	"89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
	"hex",
);
const TicketSchema = CreateFileUploadUrlResponseSchema.extend({ fields: z.object({ key: z.string(), token: z.string() }).strict() });

describe("File lifecycle with MALWARE_SCANNER=none (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let session: LoginResult;
	let adminId: string;

	async function send(options: {
		method: "GET" | "POST";
		url: string;
		headers?: Record<string, string>;
		payload?: Buffer | Record<string, string | number>;
	}): Promise<InjectResponse> {
		return app.inject({ ...options, headers: { ...options.headers, "x-forwarded-for": uniqueClientIp() } });
	}

	function cookie(): string {
		return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		session = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD);
		const result = await pool.query<{ id: string }>("SELECT id FROM public.users WHERE email = $1", [ADMIN_EMAIL]);
		adminId = z.string().parse(result.rows.at(0)?.id);
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	it("an upload becomes READY with scanStatus NOT_SCANNED", async () => {
		const checksum = createHash("sha256").update(PNG_BYTES).digest("hex");
		const ticketResponse = await send({
			method: "POST",
			url: `${FILES}/upload-url`,
			headers: mutationHeaders({ cookie: cookie() }),
			payload: { category: "USER_AVATAR", userId: adminId, fileName: "avatar.png", mimeType: "image/png", sizeBytes: PNG_BYTES.length, checksumSha256: checksum },
		});
		const ticket = TicketSchema.parse(parseSuccessEnvelope(ticketResponse, CreateFileUploadUrlResponseSchema).data);

		const boundary = `----unscanned-${randomUUID()}`;
		const body = Buffer.concat([
			...Object.entries(ticket.fields).map(([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)),
			Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="avatar.png"\r\nContent-Type: image/png\r\n\r\n`),
			PNG_BYTES,
			Buffer.from(`\r\n--${boundary}--\r\n`),
		]);
		const upload = await send({
			method: "POST",
			url: new URL(ticket.uploadUrl).pathname,
			headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
			payload: body,
		});
		expect(upload.statusCode, upload.body).toBe(201);

		const completed = await send({
			method: "POST",
			url: `${FILES}/${ticket.fileId}/complete`,
			headers: mutationHeaders({ cookie: cookie() }),
			payload: { checksumSha256: checksum },
		});
		expect(completed.statusCode, completed.body).toBe(201);

		let file = parseSuccessEnvelope(completed, z.object({ file: FileDetailResponseSchema.shape.file })).data.file;
		for (let attempt = 0; attempt < POLL_ATTEMPTS && file.status === "SCANNING"; attempt += 1) {
			await new Promise<void>((resolve: () => void): void => {
				setTimeout(resolve, POLL_INTERVAL_MS);
			});
			file = parseSuccessEnvelope(await send({ method: "GET", url: `${FILES}/${ticket.fileId}`, headers: { cookie: cookie() } }), FileDetailResponseSchema).data.file;
		}

		expect(file.status).toBe("READY");
		expect(file.scanStatus).toBe("NOT_SCANNED");
	});
});
