import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TENANT_SEED_IDS } from "../prisma/seed/tenant-seed-ids";
import { createE2eApp, login, parseSuccessEnvelope, uniqueClientIp, type LoginResult } from "./e2e-helpers";

/**
 * The admin panel's KYB review: platform staff read a merchant's evidence across tenants under the
 * `tenant.merchant.admin_read` operation, whose scope must reach the stored files themselves — without
 * them RLS hides every document and the review silently shows none.
 */

const DocumentSchema = z.object({ id: z.uuid(), fileName: z.string().min(1) });
const MerchantDetailSchema = z.looseObject({ documents: z.array(DocumentSchema) });

describe("Admin merchant KYB review (e2e)", () => {
	let app: NestFastifyApplication;
	let superAdmin: LoginResult;

	beforeAll(async () => {
		app = await createE2eApp();
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
	});

	afterAll(async () => {
		await app.close();
	});

	function get(path: string): ReturnType<NestFastifyApplication["inject"]> {
		return app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}${path}`,
			headers: { authorization: `Bearer ${superAdmin.accessToken}`, "x-forwarded-for": uniqueClientIp() },
		});
	}

	it("lists the merchant's KYB documents, and each one downloads", async () => {
		const detail = await get(`/admin/merchants/${TENANT_SEED_IDS.klTenant}`);
		expect(detail.statusCode, detail.body).toBe(200);
		const { documents } = parseSuccessEnvelope(detail, MerchantDetailSchema).data;
		expect(documents.length).toBeGreaterThan(0);

		for (const document of documents) {
			const download = await get(`/admin/merchants/${TENANT_SEED_IDS.klTenant}/documents/${document.id}/download`);
			expect(download.statusCode, download.body).toBe(200);
		}
	});
});
