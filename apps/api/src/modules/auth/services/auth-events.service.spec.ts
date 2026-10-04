import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthFlowEvent } from "@workspace/shared";

import { RequestContextService } from "../../../common/context/request-context";
import { PlatformOutboxService } from "../../../infrastructure/outbox/platform-outbox.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthEventsService } from "./auth-events.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";

const mocks = vi.hoisted(() => ({
	recordTelemetry: vi.fn<PlatformOutboxService["recordTelemetry"]>(),
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {},
}));

vi.mock("../../../infrastructure/outbox/platform-outbox.service", () => ({
	PlatformOutboxService: class {
		public readonly recordTelemetry = mocks.recordTelemetry;
	},
}));

const LOGIN_SUCCEEDED: AuthFlowEvent = { flow: "login", userId: "user-1", clientType: "web", status: "succeeded", error: null, durationMs: 12 };

function createService(): AuthEventsService {
	return new AuthEventsService(
		new PlatformOutboxService(new TenantTransactionService(new PrismaService(createTestTypedConfig()), new RequestContextService()), new RequestContextService()),
	);
}

describe("AuthEventsService.recordFlow", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.recordTelemetry.mockResolvedValue({ recorded: true, eventId: "evt-1" });
	});

	it("records the flow as an auth.flow outbox event", async () => {
		const result = await createService().recordFlow(LOGIN_SUCCEEDED);

		expect(result).toEqual({ recorded: true, eventId: "evt-1" });
		expect(mocks.recordTelemetry).toHaveBeenCalledWith({ type: "auth.flow", payload: LOGIN_SUCCEEDED });
	});

	it("surfaces a failed write as a result instead of throwing", async () => {
		mocks.recordTelemetry.mockResolvedValue({ recorded: false, error: "db down" });

		await expect(createService().recordFlow(LOGIN_SUCCEEDED)).resolves.toEqual({ recorded: false, error: "db down" });
	});

	it("rejects an event that violates the auth-flow schema", async () => {
		await expect(createService().recordFlow({ ...LOGIN_SUCCEEDED, durationMs: -5 })).rejects.toThrow();
		expect(mocks.recordTelemetry).not.toHaveBeenCalled();
	});
});
