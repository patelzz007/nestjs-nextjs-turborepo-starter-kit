import { describe, expect, it } from "vitest";

import { ApiError, HTTP_UPGRADE_REQUIRED_STATUS, readErrorPayload, UpgradeRequiredError } from "./errors";
import { jsonResponse } from "./testing";

describe("readErrorPayload: 426 Upgrade Required (ADR 033)", () => {
	it("types an enveloped 426 as UpgradeRequiredError, still an ApiError with every field", async () => {
		const payload = await readErrorPayload(
			jsonResponse(HTTP_UPGRADE_REQUIRED_STATUS, {
				success: false,
				error: { code: "APP_VERSION_UNSUPPORTED", message: "Please update the app" },
				meta: { correlationId: "corr-9", timestamp: 1_790_812_800_000 },
			}),
		);

		expect(payload).toBeInstanceOf(UpgradeRequiredError);
		expect(payload).toBeInstanceOf(ApiError);
		expect(payload).toMatchObject({
			name: "UpgradeRequiredError",
			code: "APP_VERSION_UNSUPPORTED",
			statusCode: 426,
			correlationId: "corr-9",
			message: "Please update the app",
		});
	});

	it("types a 426 with a text or empty body as UpgradeRequiredError too", async () => {
		await expect(readErrorPayload(new Response("Upgrade Required", { status: HTTP_UPGRADE_REQUIRED_STATUS }))).resolves.toMatchObject({
			name: "UpgradeRequiredError",
			statusCode: 426,
			message: "Upgrade Required",
		});
		await expect(readErrorPayload(new Response("", { status: HTTP_UPGRADE_REQUIRED_STATUS }))).resolves.toBeInstanceOf(UpgradeRequiredError);
	});

	it("leaves every other status as it was", async () => {
		const payload = await readErrorPayload(jsonResponse(400, { message: "Bad request", error: "VALIDATION_ERROR" }));

		expect(payload).toBeInstanceOf(ApiError);
		expect(payload).not.toBeInstanceOf(UpgradeRequiredError);
	});
});
