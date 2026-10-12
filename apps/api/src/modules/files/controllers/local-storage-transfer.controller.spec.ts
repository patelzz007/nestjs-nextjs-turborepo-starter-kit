import { Readable } from "node:stream";

import { Test } from "@nestjs/testing";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUBLIC_ASSET_CACHE_CONTROL } from "../../storage/domain/public-delivery.port";
import { LocalStorageTransferService, type LocalObjectDownload } from "../services/local-storage-transfer.service";
import { LocalStorageTransferController } from "./local-storage-transfer.controller";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const FILE_ID = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";

function download(): LocalObjectDownload {
	return { stream: Readable.from([Buffer.from("RIFF")]), mimeType: "image/webp", disposition: "inline", fileName: "cover.webp" };
}

/** What the controller reads from the transfer service — the real one reads the database and the local disk. */
const transfers = {
	download: vi.fn((): Promise<LocalObjectDownload> => Promise.resolve(download())),
	downloadPublic: vi.fn((): Promise<LocalObjectDownload> => Promise.resolve(download())),
};

let app: FastifyInstance;

beforeEach(async (): Promise<void> => {
	const moduleRef = await Test.createTestingModule({
		controllers: [LocalStorageTransferController],
		providers: [{ provide: LocalStorageTransferService, useValue: transfers }],
	}).compile();
	const controller = moduleRef.get(LocalStorageTransferController);
	app = Fastify();
	app.get("/public", async (_request, reply: FastifyReply): Promise<void> => {
		await controller.localPublic({ fileId: FILE_ID }, reply);
	});
	app.get("/private", async (_request, reply: FastifyReply): Promise<void> => {
		await controller.localDownload({ token: "signed-token" }, reply);
	});
});

afterEach(async (): Promise<void> => {
	await app.close();
});

describe("LocalStorageTransferController caching", () => {
	it("lets browsers cache a public asset exactly as they cache the CDN copy", async () => {
		const response = await app.inject({ method: "GET", url: "/public" });

		expect(response.statusCode).toBe(200);
		expect(response.headers["cache-control"]).toBe(PUBLIC_ASSET_CACHE_CONTROL);
		expect(response.headers["content-type"]).toBe("image/webp");
		expect(transfers.downloadPublic).toHaveBeenCalledWith(FILE_ID);
	});

	it("never caches a private object behind a signed link", async () => {
		const response = await app.inject({ method: "GET", url: "/private" });

		expect(response.headers["cache-control"]).toBe("private, no-store");
		expect(transfers.download).toHaveBeenCalledWith("signed-token");
	});
});
