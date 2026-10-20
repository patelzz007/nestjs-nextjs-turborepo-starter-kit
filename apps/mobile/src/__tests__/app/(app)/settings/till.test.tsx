import { buildPosPairingQrPayload, RedemptionCheckoutSchema, type RedemptionCheckoutInput } from "@workspace/shared";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";

import { dynamic, fail, ok, stubApi } from "../../../../../test/api-stub";
import { createTestRuntime, renderInApp } from "../../../../../test/app-harness";
import { cameraPermissionRequests, isReadingQrCodes, readQrCode, setCameraPermission } from "../../../../../test/expo-camera-fake";
import { testAccessToken } from "../../../../../test/jwt";
import { memorySecureStore } from "../../../../../test/secure-store-memory";
import TillScreen from "../../../../app/(app)/settings/till";
import { pairedTerminalOf, savePairedTerminal } from "../../../../contexts/pos";
import { SECURE_STORE_ENTRIES } from "../../../../lib/secure-store";

const PAIRED = {
	apiKey: "mk_live_till_key",
	terminalId: "TERM-7F3K9QX2",
	terminalName: "Front counter",
	tenant: { id: "2c7e9a14-5b3d-4f8e-a1c6-9d0b3e7f2a58", slug: "kopi-co", displayName: "Kopi & Co" },
	location: { id: "5b1f2c4e-8a3d-4e6f-9b7a-1c2d3e4f5a6b", name: "KLCC" },
};
const CLAIM_ID = "8f5b1c2e-3d4a-4b6c-9e7f-1a2b3c4d5e6f";
const TOKEN = "k3J9xQ2mV8pL1tR6wZ4bN7cY0dF5gH2s";
const CLAIM_EXPIRES_AT = 1_793_000_000_000;

function preview(overrides: Partial<{ valid: boolean; invalidReason: string | null; minSpendMinor: number | null }> = {}): ReturnType<typeof ok> {
	return ok({
		claimId: CLAIM_ID,
		rewardTitle: "Free flat white",
		rewardType: "FREE_ITEM",
		claimExpiresAt: CLAIM_EXPIRES_AT,
		valid: true,
		invalidReason: null,
		minSpendMinor: null,
		...overrides,
	});
}

function receipt(billTotalMinor: number, idempotencyKey: string): ReturnType<typeof ok> {
	return ok({
		saleId: "0e9d8c7b-6a5f-4e3d-8c2b-1a0f9e8d7c6b",
		billTotalMinor,
		currency: "MYR",
		paidAt: 1_792_000_000_000,
		idempotencyKey,
		redemptions: [
			{ redemptionId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", claimId: CLAIM_ID, rewardId: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", rewardTitle: "Free flat white" },
		],
	});
}

/** The checkout request as the till sent it. */
const CheckoutBodySchema = {
	parse: (body: string | null | undefined): RedemptionCheckoutInput => RedemptionCheckoutSchema.parse(JSON.parse(body ?? "{}")),
};

async function renderTill(): Promise<void> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, { "settings/till": TillScreen }, "/settings/till");
}

async function renderPairedTill(): Promise<void> {
	await savePairedTerminal(pairedTerminalOf(PAIRED));
	await renderTill();
	await screen.findByText("Front counter");
}

async function scan(text: string): Promise<void> {
	await waitFor(() => {
		expect(isReadingQrCodes()).toBe(true);
	});
	await act(async (): Promise<void> => {
		readQrCode(text);
		await Promise.resolve();
	});
}

describe("Till — pairing", () => {
	it("pairs with a typed code, with no session on the call, and keeps the terminal's key", async () => {
		const api = stubApi({ "POST /integration/terminals/pair": ok(PAIRED) });
		await renderTill();

		await fireEvent.changeText(await screen.findByLabelText("Pairing code"), "abcd2345");
		await fireEvent.press(screen.getByRole("button", { name: "Pair" }));

		expect(await screen.findByText("Front counter")).toBeOnTheScreen();
		expect(screen.getByText("KLCC")).toBeOnTheScreen();
		expect(screen.getByText("Kopi & Co")).toBeOnTheScreen();
		const [pairCall] = api.callsTo("POST /integration/terminals/pair");
		expect(pairCall?.body).toBe(JSON.stringify({ pairingCode: "ABCD2345" }));
		expect(pairCall?.headers.authorization).toBeUndefined();
		expect(memorySecureStore.peek(SECURE_STORE_ENTRIES.tillApiKey.key)).toBe(JSON.stringify(PAIRED.apiKey));
	});

	it("pairs by scanning the merchant console's pairing QR", async () => {
		const api = stubApi({ "POST /integration/terminals/pair": ok(PAIRED) });
		await renderTill();

		await fireEvent.press(await screen.findByRole("button", { name: "Scan pairing QR" }));
		await scan(buildPosPairingQrPayload("ABCD2345"));

		expect(await screen.findByText("Front counter")).toBeOnTheScreen();
		expect(api.callsTo("POST /integration/terminals/pair").at(0)?.body).toBe(JSON.stringify({ pairingCode: "ABCD2345" }));
	});

	it("explains a scanned QR that is not a pairing code, and sends nothing", async () => {
		const api = stubApi({});
		await renderTill();

		await fireEvent.press(await screen.findByRole("button", { name: "Scan pairing QR" }));
		await scan(TOKEN);

		expect(await screen.findByText("That isn't a terminal pairing QR code. Scan the code shown in the merchant console.")).toBeOnTheScreen();
		expect(api.calls).toHaveLength(0);
	});

	it("checks a typed code before sending it", async () => {
		const api = stubApi({});
		await renderTill();

		await fireEvent.changeText(await screen.findByLabelText("Pairing code"), "ABC");
		await fireEvent.press(screen.getByRole("button", { name: "Pair" }));

		expect(await screen.findByText("Enter the 8-character code shown in the merchant console.")).toBeOnTheScreen();
		expect(api.calls).toHaveLength(0);
	});

	it("shows the API's refusal of an expired or used code", async () => {
		stubApi({ "POST /integration/terminals/pair": fail(404, "PAIRING_CODE_INVALID", "This pairing code is invalid or has expired") });
		await renderTill();

		await fireEvent.changeText(await screen.findByLabelText("Pairing code"), "ABCD2345");
		await fireEvent.press(screen.getByRole("button", { name: "Pair" }));

		expect(await screen.findByText("This pairing code is invalid or has expired")).toBeOnTheScreen();
		expect(memorySecureStore.peek(SECURE_STORE_ENTRIES.tillApiKey.key)).toBeNull();
	});

	it("asks for the camera only once the scanner opens", async () => {
		setCameraPermission(false, true);
		stubApi({});
		await renderTill();
		await screen.findByRole("button", { name: "Scan pairing QR" });
		expect(cameraPermissionRequests()).toBe(0);

		await fireEvent.press(screen.getByRole("button", { name: "Scan pairing QR" }));

		await waitFor(() => {
			expect(cameraPermissionRequests()).toBe(1);
		});
		expect(screen.getByRole("button", { name: "Allow camera" })).toBeOnTheScreen();
	});
});

describe("Till — redeeming", () => {
	it("scans the customer's QR, checks it with the till's key, and redeems it on the bill", async () => {
		const api = stubApi({
			"POST /integration/redemptions/validate": preview(),
			"POST /integration/redemptions/checkout": dynamic((call) => receipt(2550, CheckoutBodySchema.parse(call.body).idempotencyKey)),
		});
		await renderPairedTill();

		await fireEvent.press(screen.getByRole("button", { name: "Scan customer QR" }));
		await scan(TOKEN);

		expect(await screen.findByText("Free flat white")).toBeOnTheScreen();
		expect(screen.getByText("Valid — enter the bill to redeem it.")).toBeOnTheScreen();
		const [validateCall] = api.callsTo("POST /integration/redemptions/validate");
		expect(validateCall?.body).toBe(JSON.stringify({ token: TOKEN }));
		expect(validateCall?.headers["x-api-key"]).toBe(PAIRED.apiKey);
		expect(validateCall?.headers["x-terminal-id"]).toBe(PAIRED.terminalId);
		expect(validateCall?.headers.authorization).toBeUndefined();

		await fireEvent.changeText(screen.getByLabelText("Bill total"), "25.50");
		await fireEvent.press(screen.getByRole("button", { name: "Redeem" }));

		expect(await screen.findByText(/Free flat white redeemed on a RM\s?25\.50 bill\./u)).toBeOnTheScreen();
		const [checkoutCall] = api.callsTo("POST /integration/redemptions/checkout");
		const body = CheckoutBodySchema.parse(checkoutCall?.body);
		expect(body).toMatchObject({ billTotalMinor: 2550, currency: "MYR", codes: [{ token: TOKEN }] });
		expect(body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/u);
		expect(checkoutCall?.headers["x-api-key"]).toBe(PAIRED.apiKey);
	});

	it("retries a failed checkout with the same idempotency key, so the reward is redeemed once", async () => {
		const answers = [fail(503, "SERVICE_UNAVAILABLE", "Try again in a moment")];
		const api = stubApi({
			"POST /integration/redemptions/validate": preview(),
			"POST /integration/redemptions/checkout": dynamic((call) => answers.shift() ?? receipt(2550, CheckoutBodySchema.parse(call.body).idempotencyKey)),
		});
		await renderPairedTill();
		await fireEvent.press(screen.getByRole("button", { name: "Scan customer QR" }));
		await scan(TOKEN);
		await fireEvent.changeText(await screen.findByLabelText("Bill total"), "25.50");

		await fireEvent.press(screen.getByRole("button", { name: "Redeem" }));
		expect(await screen.findByText("Try again in a moment")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Redeem" }));

		expect(await screen.findByText("Redeemed")).toBeOnTheScreen();
		const [first, second] = api.callsTo("POST /integration/redemptions/checkout").map((call) => CheckoutBodySchema.parse(call.body).idempotencyKey);
		expect(second).toBe(first);
	});

	it("explains why a code cannot be redeemed and offers no checkout", async () => {
		const api = stubApi({ "POST /integration/redemptions/validate": preview({ valid: false, invalidReason: "EXPIRED" }) });
		await renderPairedTill();

		await fireEvent.press(screen.getByRole("button", { name: "Scan customer QR" }));
		await scan(TOKEN);

		expect(await screen.findByText("This reward has expired.")).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Redeem" })).toBeNull();
		expect(api.callsTo("POST /integration/redemptions/checkout")).toHaveLength(0);
	});

	it("holds a bill under the reward's minimum spend before sending it", async () => {
		const api = stubApi({ "POST /integration/redemptions/validate": preview({ minSpendMinor: 3000 }) });
		await renderPairedTill();
		await fireEvent.press(screen.getByRole("button", { name: "Scan customer QR" }));
		await scan(TOKEN);

		await fireEvent.changeText(await screen.findByLabelText("Bill total"), "25");
		await fireEvent.press(screen.getByRole("button", { name: "Redeem" }));

		expect(await screen.findByText(/This reward needs a bill of at least RM\s?30\.00\./u)).toBeOnTheScreen();
		expect(api.callsTo("POST /integration/redemptions/checkout")).toHaveLength(0);
	});

	it("checks a typed backup code when the customer's QR will not scan", async () => {
		const api = stubApi({ "POST /integration/redemptions/validate": preview() });
		await renderPairedTill();

		await fireEvent.changeText(screen.getByLabelText("Or type their backup code"), "wxyz6789");
		await fireEvent.press(screen.getByRole("button", { name: "Check code" }));

		expect(await screen.findByText("Free flat white")).toBeOnTheScreen();
		expect(api.callsTo("POST /integration/redemptions/validate").at(0)?.body).toBe(JSON.stringify({ backupCode: "WXYZ6789" }));
	});

	it("explains a scanned pairing code at the counter, and sends nothing", async () => {
		const api = stubApi({});
		await renderPairedTill();

		await fireEvent.press(screen.getByRole("button", { name: "Scan customer QR" }));
		await scan(buildPosPairingQrPayload("ABCD2345"));

		expect(await screen.findByText("That's a terminal pairing code. Scan the customer's reward QR code instead.")).toBeOnTheScreen();
		expect(api.calls).toHaveLength(0);
	});

	it("unpairs the phone and forgets its key", async () => {
		stubApi({});
		await renderPairedTill();

		await fireEvent.press(screen.getByRole("button", { name: "Unpair this phone" }));
		await fireEvent.press(await screen.findByRole("button", { name: "Unpair" }));

		expect(await screen.findByText("Pair this phone as a till")).toBeOnTheScreen();
		expect(memorySecureStore.peek(SECURE_STORE_ENTRIES.tillApiKey.key)).toBeNull();
	});
});
