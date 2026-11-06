import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, ApiErrorResponseSchema, BroadcastResponseSchema } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { BROADCAST_SEED_IMAGE_ID } from "../prisma/seed/broadcast-images";
import { NOTIFICATION_SEED_IDS } from "../prisma/seed/notifications-demo";
import { TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { createE2eApp, grantSeedUsersFullSession, login, mutationHeaders, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

const DataSchema = z.object({ data: z.looseObject({}) });
const IdRowsSchema = z.array(z.object({ id: z.string() }));
const OWNER_EMAIL = "brew.owner@kl-rewards.demo";
const BROADCASTS = `/tenants/${TENANT_SEED_SLUGS.kl}/broadcasts`;

function draft(image: Record<string, string>): object {
	return {
		title: "Picture test (e2e)",
		body: {
			type: "doc",
			content: [
				{ type: "image", attrs: image },
				{ type: "paragraph", content: [{ type: "text", text: "Come and see." }] },
			],
		},
		audience: { kind: "tenant-customers", claimedWithinDays: 60, redeemed: "any", locationId: null, customerIds: null },
		channels: ["IN_APP"],
		category: "MARKETING",
		sendMode: "INSTANT",
		sendAt: null,
		localSendAt: null,
	};
}

/**
 * Enhancement 5.4: pictures in broadcasts over the real API, database and file pipeline. The seed holds a READY
 * public BROADCAST_IMAGE of Brew & Bean KL, shown by its seeded draft.
 */
describe("Pictures in broadcasts (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;

	function call(method: "GET" | "POST" | "DELETE", path: string, payload?: object): Promise<InjectResponse> {
		const auth = { authorization: `Bearer ${owner.accessToken}`, "x-client-type": "merchant", "x-forwarded-for": uniqueClientIp() };
		return app.inject({
			method,
			url: `${API_VERSION_PREFIX}${path}`,
			headers: method === "GET" ? auth : mutationHeaders(auth),
			...(payload === undefined ? {} : { payload }),
		});
	}

	/** The first block of a broadcast response, read as a picture (fails the test when it isn't one). */
	function imageOf(response: InjectResponse): { readonly fileId: string; readonly alt: string; readonly src: string } {
		return z
			.object({ type: z.literal("image"), attrs: z.object({ fileId: z.string(), alt: z.string(), src: z.url({ protocol: /^https?$/u }) }) })
			.parse(BroadcastResponseSchema.parse(DataSchema.parse(response.json()).data).body.content.at(0)).attrs;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await grantSeedUsersFullSession(pool, [OWNER_EMAIL]);
		owner = await login(app, OWNER_EMAIL, "BrewOwner@123", "merchant");
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	it("answers a draft with its picture's public address", async () => {
		const response = await call("GET", `${BROADCASTS}/${NOTIFICATION_SEED_IDS.draftBroadcast}`);
		expect(response.statusCode).toBe(200);
		// The address is checked to be an http(s) URL by `imageOf`.
		expect(imageOf(response).fileId).toBe(BROADCAST_SEED_IMAGE_ID);
	});

	it("saves a draft naming the store's own picture, and answers with its address", async () => {
		const created = await call("POST", BROADCASTS, draft({ fileId: BROADCAST_SEED_IMAGE_ID, alt: "Cake" }));
		expect(created.statusCode).toBe(201);
		expect(imageOf(created)).toMatchObject({ fileId: BROADCAST_SEED_IMAGE_ID, alt: "Cake" });
	});

	it("refuses a client-sent address, and a file that isn't one of the store's broadcast pictures", async () => {
		const withSrc = await call("POST", BROADCASTS, draft({ fileId: BROADCAST_SEED_IMAGE_ID, alt: "Cake", src: "https://evil.example/tracker.gif" }));
		expect(withSrc.statusCode).toBe(400);

		const [reward] = IdRowsSchema.parse(
			(await pool.query(`SELECT id FROM public."StoredFile" WHERE category = 'REWARD_IMAGE' AND status = 'READY' AND "isDeleted" = false LIMIT 1`)).rows,
		);
		const wrongKind = await call("POST", BROADCASTS, draft({ fileId: z.string().parse(reward?.id), alt: "A reward photo" }));
		expect(wrongKind.statusCode).toBe(400);
		expect(ApiErrorResponseSchema.parse(wrongKind.json()).error.details).toMatchObject({ fileIds: [reward?.id] });
	});

	it("refuses to delete a picture a broadcast still shows", async () => {
		const deleted = await call("DELETE", `/files/${BROADCAST_SEED_IMAGE_ID}`);
		expect(deleted.statusCode).toBe(409);
		expect(ApiErrorResponseSchema.parse(deleted.json()).error.code).toBe("FILE_IN_USE_AS_BROADCAST_IMAGE");
	});
});
