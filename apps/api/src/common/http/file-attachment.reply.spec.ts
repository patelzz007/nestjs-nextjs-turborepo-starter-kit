import { Readable } from "node:stream";

import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { attachmentDisposition, sendFileAttachment } from "./file-attachment.reply";

describe("attachmentDisposition", () => {
	it("names the file in both the plain and the RFC 5987 form", () => {
		expect(attachmentDisposition("weekend-brunch-photos.zip")).toBe(`attachment; filename="weekend-brunch-photos.zip"; filename*=UTF-8''weekend-brunch-photos.zip`);
	});
});

describe("sendFileAttachment", () => {
	let app: FastifyInstance;

	beforeEach((): void => {
		app = Fastify();
		app.get("/file", async (_request, reply: FastifyReply): Promise<void> => {
			await sendFileAttachment(reply, { fileName: "photos.zip", contentType: "application/zip", body: Readable.from([Buffer.from("PK"), Buffer.from("zip")]) });
		});
	});

	afterEach(async (): Promise<void> => {
		await app.close();
	});

	it("streams the body as an uncached, unsniffed attachment of its media type", async () => {
		const response = await app.inject({ method: "GET", url: "/file" });

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toBe("application/zip");
		expect(response.headers["content-disposition"]).toBe(attachmentDisposition("photos.zip"));
		expect(response.headers["cache-control"]).toBe("private, no-store, max-age=0");
		expect(response.headers["x-content-type-options"]).toBe("nosniff");
		expect(response.body).toBe("PKzip");
	});
});
