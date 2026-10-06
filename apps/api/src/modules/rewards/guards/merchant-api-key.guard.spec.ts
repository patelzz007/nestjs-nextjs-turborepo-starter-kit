import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHttpContext, testRequest, type TestHttpRequest } from "../../../../test/support/http-execution-context";
import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { MerchantApiKeyVerificationService } from "../../api-keys/services/merchant-api-key-verification.service";
import { MerchantApiKeyRepository } from "../repositories/merchant-api-key.repository";
import { MerchantTerminalRepository } from "../repositories/merchant-terminal.repository";
import { RequestContextService } from "../../../common/context/request-context";
import { MERCHANT_POS_CONTEXT_KEY, type MerchantPosContext } from "../types/merchant-pos-context";
import { MerchantApiKeyGuard } from "./merchant-api-key.guard";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), findTerminal: vi.fn(), touchTerminal: vi.fn() }));

vi.mock("../../api-keys/services/merchant-api-key-verification.service", () => ({
	MerchantApiKeyVerificationService: class {
		public readonly verify = mocks.verify;
	},
}));

vi.mock("../repositories/merchant-api-key.repository", () => ({ MerchantApiKeyRepository: class {} }));

const STORE_A = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
const STORE_B = "5e0b4a6f-3a7c-4d66-9a1d-0b5c2d3e4f50";

const PAIRED_TERMINAL = { id: "terminal-row-1", terminalId: "TERM-ABCD2345", locationId: STORE_B };

interface KeyContextOptions {
	readonly terminal?: typeof PAIRED_TERMINAL | null;
	readonly requireRegisteredTerminals?: boolean;
}

function keyContext(locationId: string | null, { terminal = null, requireRegisteredTerminals = false }: KeyContextOptions = {}): object {
	return { provider: "merchant", apiKeyId: "key-1", organizationId: "org-1", locationId, terminal, requireRegisteredTerminals, capabilities: [] };
}

function guard(): MerchantApiKeyGuard {
	const prisma = createTestPrisma();
	const terminals = new MerchantTerminalRepository(prisma);
	vi.spyOn(terminals, "findLiveByTerminalId").mockImplementation(mocks.findTerminal);
	vi.spyOn(terminals, "touchLastSeen").mockImplementation(mocks.touchTerminal);
	return new MerchantApiKeyGuard(new MerchantApiKeyVerificationService(new MerchantApiKeyRepository(prisma)), terminals, new RequestContextService());
}

/** The test request, plus the POS context the guard attaches to it. */
type PosRequest = TestHttpRequest & { [MERCHANT_POS_CONTEXT_KEY]?: MerchantPosContext };

function request(terminalId: string | undefined): PosRequest {
	return testRequest({ headers: { "x-api-key": "mk_live_test", ...(terminalId !== undefined ? { "x-terminal-id": terminalId } : {}) } });
}

async function storeOf(req: PosRequest): Promise<string | null | undefined> {
	await guard().canActivate(createHttpContext(req));
	return req[MERCHANT_POS_CONTEXT_KEY]?.locationId;
}

describe("MerchantApiKeyGuard", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		mocks.verify.mockReset();
		mocks.findTerminal.mockReset();
		mocks.touchTerminal.mockReset();
	});

	it("requires a well-formed terminal id", async () => {
		mocks.verify.mockResolvedValue(keyContext(null));

		await expect(guard().canActivate(createHttpContext(request(undefined)))).rejects.toBeInstanceOf(UnauthorizedException);
		await expect(guard().canActivate(createHttpContext(request("till 1!")))).rejects.toBeInstanceOf(BadRequestException);
	});

	it("binds the key (and its terminal) as the request's principal in the request context", async () => {
		mocks.verify.mockResolvedValue(keyContext(STORE_A));
		mocks.findTerminal.mockResolvedValue(null);
		const requestContext = new RequestContextService();

		const bound = await requestContext.run({ correlationId: "corr-pos", ip: undefined, userAgent: undefined, edgeLocation: undefined }, async () => {
			await guard().canActivate(createHttpContext(request("NEW-TILL")));
			return requestContext.current()?.apiKey;
		});

		// The key's own store (not the till's) is the request's database store scope.
		expect(bound).toEqual({ apiKeyId: "key-1", organizationId: "org-1", terminalId: "NEW-TILL", locationId: STORE_A });
	});

	it("rejects an unknown key", async () => {
		mocks.verify.mockResolvedValue(null);

		await expect(guard().canActivate(createHttpContext(request("KL-REGISTER-01")))).rejects.toBeInstanceOf(UnauthorizedException);
	});

	it("uses a store-scoped key's store, even on an unregistered till", async () => {
		mocks.verify.mockResolvedValue(keyContext(STORE_A));
		mocks.findTerminal.mockResolvedValue(null);

		await expect(storeOf(request("NEW-TILL"))).resolves.toBe(STORE_A);
	});

	it("falls back to the registered terminal's store for an organization-wide key, else unknown", async () => {
		mocks.verify.mockResolvedValue(keyContext(null));
		mocks.findTerminal.mockResolvedValue({ id: "terminal-row-3", locationId: STORE_B });
		await expect(storeOf(request("KL-REGISTER-02"))).resolves.toBe(STORE_B);

		mocks.findTerminal.mockResolvedValue(null);
		await expect(storeOf(request("NEW-TILL"))).resolves.toBeNull();
	});

	it("refuses a store-scoped key on a terminal registered to another store", async () => {
		mocks.verify.mockResolvedValue(keyContext(STORE_A));
		mocks.findTerminal.mockResolvedValue({ id: "terminal-row-3", locationId: STORE_B });

		await expect(guard().canActivate(createHttpContext(request("KL-REGISTER-02")))).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("lets a paired key identify its till without X-Terminal-Id, at the terminal's store", async () => {
		mocks.verify.mockResolvedValue(keyContext(STORE_B, { terminal: PAIRED_TERMINAL }));
		const req = request(undefined);

		await expect(storeOf(req)).resolves.toBe(STORE_B);
		expect(req[MERCHANT_POS_CONTEXT_KEY]?.terminalId).toBe(PAIRED_TERMINAL.terminalId);
		expect(mocks.touchTerminal).toHaveBeenCalledWith(PAIRED_TERMINAL.id, expect.any(Number));
		expect(mocks.findTerminal).not.toHaveBeenCalled();
	});

	it("refuses a paired key sent with another terminal's id", async () => {
		mocks.verify.mockResolvedValue(keyContext(STORE_B, { terminal: PAIRED_TERMINAL }));

		await expect(guard().canActivate(createHttpContext(request("KL-REGISTER-01")))).rejects.toBeInstanceOf(ForbiddenException);
		await expect(storeOf(request(PAIRED_TERMINAL.terminalId))).resolves.toBe(STORE_B);
	});

	it("refuses an unregistered till for a manual key once the merchant requires registered terminals", async () => {
		mocks.verify.mockResolvedValue(keyContext(null, { requireRegisteredTerminals: true }));
		mocks.findTerminal.mockResolvedValue(null);
		await expect(guard().canActivate(createHttpContext(request("NEW-TILL")))).rejects.toBeInstanceOf(UnauthorizedException);

		mocks.findTerminal.mockResolvedValue({ id: "terminal-row-2", locationId: STORE_A });
		await expect(storeOf(request("KL-REGISTER-01"))).resolves.toBe(STORE_A);
		expect(mocks.touchTerminal).toHaveBeenCalledWith("terminal-row-2", expect.any(Number));
	});
});
