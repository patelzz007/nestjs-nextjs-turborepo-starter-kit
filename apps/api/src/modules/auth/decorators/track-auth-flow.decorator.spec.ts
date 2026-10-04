import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestContextService } from "../../../common/context/request-context";
import { PlatformOutboxService } from "../../../infrastructure/outbox/platform-outbox.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthEventsService } from "../services/auth-events.service";
import { AuthFlowTrackingError, identifyAuthFlowSubject, TrackAuthFlow } from "./track-auth-flow.decorator";
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

/** How the fake flow body ends. */
type FlowOutcome = "accept" | "reject-known-user" | "reject-unknown-user" | "reject-plain-http" | "crash" | "accept-anonymous";

const KNOWN_USER_ID = "user-1";

/** A login-shaped flow body; the spec applies the decorator by hand (spec files are compiled without decorator syntax). */
async function loginFlow(outcome: FlowOutcome, userId: string = KNOWN_USER_ID): Promise<{ readonly message: string }> {
	mocks.steps.push("flow");
	if (outcome === "reject-unknown-user") {
		throw new UnauthorizedException({ message: "Invalid email or password", error: "INVALID_CREDENTIALS" });
	}
	if (outcome === "accept-anonymous") {
		return Promise.resolve({ message: "ok" });
	}
	identifyAuthFlowSubject(userId);
	await Promise.resolve();
	if (outcome === "reject-known-user") {
		throw new UnauthorizedException({ message: "Invalid email or password", error: "INVALID_CREDENTIALS" });
	}
	if (outcome === "reject-plain-http") {
		throw new BadRequestException("Password cannot be one of your last 5 passwords");
	}
	if (outcome === "crash") {
		throw new Error("connection reset while talking to db-host-17");
	}
	return { message: "ok" };
}

const descriptor: TypedPropertyDescriptor<typeof loginFlow> = { value: loginFlow, writable: true, configurable: true };
const trackedLogin = TrackAuthFlow({ flow: "login", clientType: (): string => "web" })({}, "login", descriptor).value;

interface FlowHost {
	readonly authEvents?: AuthEventsService;
}

function createHost(): FlowHost {
	return {
		authEvents: new AuthEventsService(
			new PlatformOutboxService(new TenantTransactionService(new PrismaService(createTestTypedConfig()), new RequestContextService()), new RequestContextService()),
		),
	};
}

async function login(outcome: FlowOutcome, userId?: string, host: FlowHost = createHost()): Promise<{ readonly message: string }> {
	if (trackedLogin === undefined) {
		throw new Error("TrackAuthFlow must return a descriptor with a value");
	}
	return trackedLogin.call(host, outcome, userId);
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

	it("awaits the durable record of a succeeded flow, with the user the flow identified", async () => {
		await expect(login("accept")).resolves.toEqual({ message: "ok" });

		expect(mocks.steps).toEqual(["flow", "record"]);
		expect(mocks.recordFlow).toHaveBeenCalledWith(expect.objectContaining({ flow: "login", userId: KNOWN_USER_ID, clientType: "web", status: "succeeded", error: null }));
	});

	it("records a failure for a known user with the user AND the stable error code (never the message), and rethrows", async () => {
		await expect(login("reject-known-user")).rejects.toBeInstanceOf(UnauthorizedException);

		expect(mocks.recordFlow).toHaveBeenCalledWith(expect.objectContaining({ flow: "login", userId: KNOWN_USER_ID, status: "failed", error: "INVALID_CREDENTIALS" }));
	});

	it("records null when the flow never resolved a user", async () => {
		await expect(login("reject-unknown-user")).rejects.toBeInstanceOf(UnauthorizedException);
		await expect(login("accept-anonymous")).resolves.toEqual({ message: "ok" });

		expect(mocks.recordFlow).toHaveBeenNthCalledWith(1, expect.objectContaining({ userId: null, status: "failed", error: "INVALID_CREDENTIALS" }));
		expect(mocks.recordFlow).toHaveBeenNthCalledWith(2, expect.objectContaining({ userId: null, status: "succeeded", error: null }));
	});

	it("maps an HttpException without a domain code to its standard status code", async () => {
		await expect(login("reject-plain-http")).rejects.toBeInstanceOf(BadRequestException);

		expect(mocks.recordFlow).toHaveBeenCalledWith(expect.objectContaining({ userId: KNOWN_USER_ID, error: "BAD_REQUEST" }));
	});

	it("records INTERNAL_ERROR for an unexpected error and never leaks its message", async () => {
		await expect(login("crash")).rejects.toThrow("connection reset");

		expect(mocks.recordFlow).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", error: "INTERNAL_ERROR" }));
		expect(JSON.stringify(mocks.recordFlow.mock.calls)).not.toContain("db-host-17");
	});

	it("keeps each concurrent invocation's user separate", async () => {
		await Promise.all([login("accept", "user-a"), login("accept", "user-b")]);

		const recordedUsers = mocks.recordFlow.mock.calls.map(([event]) => event.userId).sort();
		expect(recordedUsers).toEqual(["user-a", "user-b"]);
	});

	it("keeps the flow's own outcome when recording the event fails", async () => {
		mocks.recordFlow.mockResolvedValue({ recorded: false, error: "db down" });

		await expect(login("accept")).resolves.toEqual({ message: "ok" });
		await expect(login("reject-known-user")).rejects.toBeInstanceOf(UnauthorizedException);
	});

	it("fails loudly, without running the flow, when the host does not inject authEvents", async () => {
		await expect(login("accept", KNOWN_USER_ID, {})).rejects.toBeInstanceOf(AuthFlowTrackingError);

		expect(mocks.steps).toEqual([]);
	});

	it("rejects identifyAuthFlowSubject outside a tracked flow", () => {
		expect(() => {
			identifyAuthFlowSubject(KNOWN_USER_ID);
		}).toThrow(AuthFlowTrackingError);
	});
});
