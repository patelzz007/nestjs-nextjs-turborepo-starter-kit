import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestContextService } from "../../../common/context/request-context";
import { PlatformOutboxService } from "../../../infrastructure/outbox/platform-outbox.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthEventsService } from "../services/auth-events.service";
import { TrackAuthFlow } from "./track-auth-flow.decorator";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";

const mocks = vi.hoisted(() => ({
	recordFlow: vi.fn<AuthEventsService["recordFlow"]>(),
	steps: new Array<string>(),
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {},
}));

vi.mock("../services/auth-events.service", () => ({
	AuthEventsService: class {
		public readonly recordFlow = mocks.recordFlow;
	},
}));

/** A login flow body; the spec applies the decorator by hand (spec files are compiled without decorator syntax). */
async function loginFlow(outcome: string): Promise<{ readonly id: string }> {
	mocks.steps.push("flow");
	if (outcome === "reject") {
		throw new UnauthorizedException({ message: "Invalid credentials", error: "INVALID_CREDENTIALS" });
	}
	return Promise.resolve({ id: "user-1" });
}

const descriptor: TypedPropertyDescriptor<typeof loginFlow> = { value: loginFlow, writable: true, configurable: true };
const trackedLogin = TrackAuthFlow({ flow: "login", clientType: (): string => "web" })({}, "login", descriptor).value;

interface FlowHost {
	readonly authEvents: AuthEventsService;
}

function createHost(): FlowHost {
	return {
		authEvents: new AuthEventsService(new PlatformOutboxService(new TenantTransactionService(new PrismaService(createTestTypedConfig())), new RequestContextService())),
	};
}

async function login(outcome: string): Promise<{ readonly id: string }> {
	if (trackedLogin === undefined) {
		throw new Error("TrackAuthFlow must return a descriptor with a value");
	}
	return trackedLogin.call(createHost(), outcome);
}

describe("@TrackAuthFlow", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.steps.length = 0;
		mocks.recordFlow.mockImplementation(async (): Promise<{ readonly recorded: true; readonly eventId: string }> => {
			mocks.steps.push("record");
			return Promise.resolve({ recorded: true, eventId: "evt-1" });
		});
	});

	it("awaits the durable record of a succeeded flow before returning", async () => {
		await expect(login("accept")).resolves.toEqual({ id: "user-1" });

		expect(mocks.steps).toEqual(["flow", "record"]);
		expect(mocks.recordFlow).toHaveBeenCalledWith(expect.objectContaining({ flow: "login", userId: "user-1", clientType: "web", status: "succeeded", error: null }));
	});

	it("records a failed flow with its error and rethrows the original error", async () => {
		await expect(login("reject")).rejects.toBeInstanceOf(UnauthorizedException);

		expect(mocks.recordFlow).toHaveBeenCalledWith(expect.objectContaining({ flow: "login", status: "failed", error: "Invalid credentials" }));
	});

	it("keeps the flow's own outcome when recording the event fails", async () => {
		mocks.recordFlow.mockResolvedValue({ recorded: false, error: "db down" });

		await expect(login("accept")).resolves.toEqual({ id: "user-1" });
		await expect(login("reject")).rejects.toBeInstanceOf(UnauthorizedException);
	});
});
