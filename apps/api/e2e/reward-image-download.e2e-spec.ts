import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AdminRewardImageDownloadResponseSchema, API_VERSION_PREFIX, ApiErrorResponseSchema } from "@workspace/shared";

import { REWARD_SEED_IDS } from "../prisma/seed/rewards";
import { rewardImageSeedId } from "../prisma/seed/reward-images";
import { createE2eApp, login, type LoginResult, parseSuccessEnvelope } from "./e2e-helpers";

/** The seeded pending reward shows the `weekend-brunch` set; `free-coffee` belongs to another reward. */
const PENDING_REWARD_ID = REWARD_SEED_IDS.klRewardPending;
const PENDING_REWARD_SECOND_IMAGE = rewardImageSeedId("weekend-brunch/02.webp");
const OTHER_REWARD_IMAGE = rewardImageSeedId("free-coffee/01.webp");

function downloadPath(rewardId: string, fileId: string): string {
	return `${API_VERSION_PREFIX}/admin/rewards/${rewardId}/images/${fileId}/download`;
}

function archivePath(rewardId: string): string {
	return `${API_VERSION_PREFIX}/admin/rewards/${rewardId}/images/archive`;
}

function cookieOf(session: LoginResult): string {
	return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
}

/**
 * Reviewers download a reward's photos at full resolution: the route signs a
 * URL for the original upload, served as an attachment — only for an image of
 * that reward, and only to someone who may moderate rewards.
 */
describe("Admin reward image download (e2e)", () => {
	let app: NestFastifyApplication;
	let superAdmin: LoginResult;
	let consumer: LoginResult;

	beforeAll(async () => {
		app = await createE2eApp();
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123");
		consumer = await login(app, "user@example.com", "User@123");
	});

	afterAll(async () => {
		await app.close();
	});

	it("signs a URL that downloads the original 4K upload as an attachment", async () => {
		const response = await app.inject({ method: "GET", url: downloadPath(PENDING_REWARD_ID, PENDING_REWARD_SECOND_IMAGE), headers: { cookie: cookieOf(superAdmin) } });

		expect(response.statusCode).toBe(200);
		const { data } = parseSuccessEnvelope(response, AdminRewardImageDownloadResponseSchema);
		expect(data.fileId).toBe(PENDING_REWARD_SECOND_IMAGE);
		expect(data.fileName).toBe("weekend-brunch-02.webp");
		expect(data.expiresAt).toBeGreaterThan(Date.now());

		// Local storage signs a link to its own transfer route; fetch it as the browser would.
		const signed = new URL(data.downloadUrl);
		const file = await app.inject({ method: "GET", url: `${signed.pathname}${signed.search}` });
		expect(file.statusCode).toBe(200);
		expect(file.headers["content-type"]).toBe("image/webp");
		expect(String(file.headers["content-disposition"])).toMatch(/^attachment;.*weekend-brunch-02\.webp/u);
		expect(file.rawPayload.byteLength).toBeGreaterThan(0);
	});

	it("is a 404 for another reward's image, so a file id alone opens nothing", async () => {
		const response = await app.inject({ method: "GET", url: downloadPath(PENDING_REWARD_ID, OTHER_REWARD_IMAGE), headers: { cookie: cookieOf(superAdmin) } });

		expect(response.statusCode).toBe(404);
		expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("REWARD_IMAGE_NOT_FOUND");
	});

	it("is refused to someone who may not moderate rewards", async () => {
		const response = await app.inject({ method: "GET", url: downloadPath(PENDING_REWARD_ID, PENDING_REWARD_SECOND_IMAGE), headers: { cookie: cookieOf(consumer) } });

		expect(response.statusCode).toBe(403);
	});

	it("streams every photo of the reward as one ZIP of the original uploads, in display order", async () => {
		const response = await app.inject({ method: "GET", url: archivePath(PENDING_REWARD_ID), headers: { cookie: cookieOf(superAdmin) } });

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toBe("application/zip");
		expect(String(response.headers["content-disposition"])).toMatch(/^attachment; filename="20-off-weekend-brunch-photos\.zip"/u);
		expect(response.headers["cache-control"]).toBe("private, no-store, max-age=0");

		const entries = unzipSync(new Uint8Array(response.rawPayload));
		expect(Object.keys(entries)).toEqual(["1-weekend-brunch-01.webp", "2-weekend-brunch-02.webp", "3-weekend-brunch-03.webp"]);

		// Byte for byte the original upload the single-photo download serves.
		const single = parseSuccessEnvelope(
			await app.inject({ method: "GET", url: downloadPath(PENDING_REWARD_ID, PENDING_REWARD_SECOND_IMAGE), headers: { cookie: cookieOf(superAdmin) } }),
			AdminRewardImageDownloadResponseSchema,
		);
		const signed = new URL(single.data.downloadUrl);
		const original = await app.inject({ method: "GET", url: `${signed.pathname}${signed.search}` });
		expect(Buffer.from(entries["2-weekend-brunch-02.webp"] ?? new Uint8Array()).equals(original.rawPayload)).toBe(true);
	});

	it("is a 404 JSON error, not an empty archive, for a reward that does not exist", async () => {
		const response = await app.inject({ method: "GET", url: archivePath(randomUUID()), headers: { cookie: cookieOf(superAdmin) } });

		expect(response.statusCode).toBe(404);
		expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("REWARD_IMAGE_NOT_FOUND");
	});

	it("refuses the archive to someone who may not moderate rewards", async () => {
		const response = await app.inject({ method: "GET", url: archivePath(PENDING_REWARD_ID), headers: { cookie: cookieOf(consumer) } });

		expect(response.statusCode).toBe(403);
	});
});
