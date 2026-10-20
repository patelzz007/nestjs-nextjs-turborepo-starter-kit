import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_VERSION_PREFIX, ApiErrorResponseSchema, RewardResponseSchema } from "@workspace/shared";

import { REWARD_SEED_IDS } from "../prisma/seed/rewards";
import { rewardImageSeedId } from "../prisma/seed/reward-images";
import { createE2eApp, login, type LoginResult, parseSuccessEnvelope } from "./e2e-helpers";

function rewardPath(rewardId: string): string {
	return `${API_VERSION_PREFIX}/admin/rewards/${rewardId}`;
}

function cookieOf(session: LoginResult): string {
	return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
}

/**
 * Reviewers open one reward from the moderation queue: the route returns it in
 * full, whatever its status — and only to someone who may moderate rewards.
 */
describe("Admin reward detail (e2e)", () => {
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

	it("returns a pending reward in full, with its merchant and photos in display order", async () => {
		const response = await app.inject({ method: "GET", url: rewardPath(REWARD_SEED_IDS.klRewardPending), headers: { cookie: cookieOf(superAdmin) } });

		expect(response.statusCode).toBe(200);
		const { data } = parseSuccessEnvelope(response, RewardResponseSchema);
		expect(data).toMatchObject({ id: REWARD_SEED_IDS.klRewardPending, title: "20% off weekend brunch", status: "PENDING_REVIEW", category: "cafe" });
		expect(data.tenantName).toBeDefined();
		expect(data.images.map((image) => image.fileId)).toEqual(["01", "02", "03"].map((position) => rewardImageSeedId(`weekend-brunch/${position}.webp`)));
	});

	it("returns a reward that is no longer pending, so the page survives a decision", async () => {
		const response = await app.inject({ method: "GET", url: rewardPath(REWARD_SEED_IDS.klRewardPublished), headers: { cookie: cookieOf(superAdmin) } });

		expect(response.statusCode).toBe(200);
		expect(parseSuccessEnvelope(response, RewardResponseSchema).data.status).toBe("PUBLISHED");
	});

	it("does not shadow the moderation queue's own route", async () => {
		const response = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/admin/rewards/pending`, headers: { cookie: cookieOf(superAdmin) } });

		expect(response.statusCode).toBe(200);
	});

	it("is a 404 for a reward that does not exist", async () => {
		const response = await app.inject({ method: "GET", url: rewardPath(randomUUID()), headers: { cookie: cookieOf(superAdmin) } });

		expect(response.statusCode).toBe(404);
		expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("REWARD_NOT_FOUND");
	});

	it("is a 400 for an id that is not a uuid", async () => {
		const response = await app.inject({ method: "GET", url: rewardPath("not-a-uuid"), headers: { cookie: cookieOf(superAdmin) } });

		expect(response.statusCode).toBe(400);
	});

	it("is refused to someone who may not moderate rewards", async () => {
		const response = await app.inject({ method: "GET", url: rewardPath(REWARD_SEED_IDS.klRewardPending), headers: { cookie: cookieOf(consumer) } });

		expect(response.statusCode).toBe(403);
	});
});
