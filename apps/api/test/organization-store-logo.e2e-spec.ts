import { createHash, randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
	API_VERSION_PREFIX,
	CreateFileUploadUrlResponseSchema,
	FileDetailResponseSchema,
	OrganizationContextResponseSchema,
	type FileStatus,
	type OrganizationLogoResponse,
} from "@workspace/shared";
import { Pool } from "pg";
import sharp from "sharp";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createE2eApp, login, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";
import { AVATAR_PNG_BYTES } from "./support/avatar-png-fixture";

// A merchant's store logo, end to end on the seeded Jonker Street Kitchen: the
// owner uploads a square logo (ticket → local upload → complete → scan), the
// organization context then carries it, a removal takes it away again, and a
// logo that is not square — or an upload by a cashier — is refused.

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const FILES = `${API_VERSION_PREFIX}/files`;
const ORG_SLUG = "jonker-street-kitchen";
const CONTEXT_URL = `${API_VERSION_PREFIX}/orgs/${ORG_SLUG}/context`;
const VERDICT_POLL_ATTEMPTS = 100;
const VERDICT_POLL_INTERVAL_MS = 100;
const TERMINAL_STATUSES: ReadonlySet<FileStatus> = new Set<FileStatus>(["READY", "QUARANTINED", "FAILED"]);

const TicketSchema = CreateFileUploadUrlResponseSchema.extend({ fields: z.object({ key: z.string(), token: z.string() }).strict() });
type Ticket = z.output<typeof TicketSchema>;

function sha256(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function multipart(fields: Readonly<Record<string, string>>, bytes: Buffer): { payload: Buffer; contentType: string } {
	const boundary = `----logo-${randomUUID()}`;
	const parts: Buffer[] = Object.entries(fields).map(([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
	parts.push(
		Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="logo.png"\r\nContent-Type: image/png\r\n\r\n`),
		bytes,
		Buffer.from(`\r\n--${boundary}--\r\n`),
	);
	return { payload: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

function pathOf(url: string): string {
	const parsed = new URL(url);
	return `${parsed.pathname}${parsed.search}`;
}

describe("Store logo (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;
	let cashier: LoginResult;
	let organizationId: string;

	async function send(
		session: LoginResult,
		options: { method: "GET" | "POST" | "DELETE"; url: string; mutation?: boolean; payload?: Buffer | Record<string, string | number> },
	): Promise<InjectResponse> {
		const cookie = `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
		const headers = options.mutation === true ? mutationHeaders({ cookie }) : { cookie };
		return app.inject({
			method: options.method,
			url: options.url,
			headers: { ...headers, "x-forwarded-for": uniqueClientIp() },
			...(options.payload === undefined ? {} : { payload: options.payload }),
		});
	}

	async function requestTicket(session: LoginResult, bytes: Buffer, assetType: "LOGO" | "BANNER" = "LOGO"): Promise<InjectResponse> {
		return send(session, {
			method: "POST",
			url: `${FILES}/upload-url`,
			mutation: true,
			payload: {
				category: "STORE_LOGO",
				organizationId,
				assetType,
				fileName: "logo.png",
				mimeType: "image/png",
				sizeBytes: bytes.length,
				checksumSha256: sha256(bytes),
			},
		});
	}

	/** Ticket → upload → complete; returns the file id and the `complete` response. */
	async function uploadLogo(bytes: Buffer): Promise<{ readonly fileId: string; readonly completed: InjectResponse }> {
		const ticketResponse = await requestTicket(owner, bytes);
		expect(ticketResponse.statusCode, ticketResponse.body).toBe(201);
		const ticket: Ticket = TicketSchema.parse(parseSuccessEnvelope(ticketResponse, CreateFileUploadUrlResponseSchema).data);
		const body = multipart(ticket.fields, bytes);
		const uploaded = await app.inject({
			method: "POST",
			url: pathOf(ticket.uploadUrl),
			headers: { "content-type": body.contentType, "x-forwarded-for": uniqueClientIp() },
			payload: body.payload,
		});
		expect(uploaded.statusCode, uploaded.body).toBe(201);
		const completed = await send(owner, { method: "POST", url: `${FILES}/${ticket.fileId}/complete`, mutation: true, payload: { checksumSha256: sha256(bytes) } });
		return { fileId: ticket.fileId, completed };
	}

	async function awaitVerdict(fileId: string): Promise<FileStatus> {
		for (let attempt = 0; attempt < VERDICT_POLL_ATTEMPTS; attempt += 1) {
			const response = await send(owner, { method: "GET", url: `${FILES}/${fileId}` });
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

	async function contextLogo(): Promise<OrganizationLogoResponse | null> {
		const response = await send(owner, { method: "GET", url: CONTEXT_URL });
		expect(response.statusCode, response.body).toBe(200);
		return parseSuccessEnvelope(response, OrganizationContextResponseSchema).data.organization.logo;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		owner = await login(app, "jonker.owner@melaka-rewards.demo", "JonkerOwner@123", "merchant");
		cashier = await login(app, "jonker.cashier@melaka-rewards.demo", "JonkerCashier@123", "merchant");
		const result = await pool.query<{ id: string }>('SELECT id FROM public."Organization" WHERE slug = $1', [ORG_SLUG]);
		organizationId = z.uuid().parse(result.rows.at(0)?.id);
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	it("binds an uploaded square logo to the organization, shows it in the context, and removes it again", async () => {
		const { fileId, completed } = await uploadLogo(AVATAR_PNG_BYTES);
		expect(completed.statusCode, completed.body).toBe(201);
		expect(await awaitVerdict(fileId)).toBe("READY");

		const logo = await contextLogo();
		expect(logo?.fileId).toBe(fileId);
		expect(logo?.url).toMatch(/^https?:\/\//u);
		// A 256 × 256 logo is served in the renditions it is wide enough for, smallest first.
		expect(logo?.sources.map((source) => source.width)).toEqual([128, 256]);

		const removed = await send(owner, { method: "DELETE", url: `${FILES}/${fileId}`, mutation: true });
		expect(removed.statusCode, removed.body).toBe(200);
		expect(await contextLogo()).toBeNull();
	});

	it("refuses a logo that is not square at complete, in the shared words", async () => {
		const wide = await sharp({ create: { width: 512, height: 256, channels: 3, background: { r: 0, g: 122, b: 77 } } })
			.png({ compressionLevel: 9, palette: true })
			.toBuffer();

		const { completed } = await uploadLogo(wide);

		expect(completed.statusCode, completed.body).toBe(400);
		expect(JSON.parse(completed.body)).toMatchObject({ success: false, error: { code: "FILE_IMAGE_DIMENSIONS_INVALID", message: "Images must be 1:1 (square)." } });
	});

	it("refuses a logo upload labelled as a banner", async () => {
		const response = await requestTicket(owner, AVATAR_PNG_BYTES, "BANNER");

		expect(response.statusCode, response.body).toBe(400);
		expect(response.body).toContain("assetType must be LOGO for STORE_LOGO uploads");
	});

	it("does not let a cashier change the store logo", async () => {
		const response = await requestTicket(cashier, AVATAR_PNG_BYTES);

		expect(response.statusCode, response.body).toBe(403);
	});
});
