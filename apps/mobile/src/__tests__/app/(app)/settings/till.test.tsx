import { buildPosPairingQrPayload, RedemptionCheckoutSchema, type RedemptionCheckoutInput } from "@workspace/shared";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { z } from "zod";

import { dynamic, fail, ok, stubApi, UNREACHABLE, type StubAnswer } from "../../../../../test/api-stub";
import { createTestRuntime, renderInApp } from "../../../../../test/app-harness";
import { cameraPermissionRequests, isReadingQrCodes, readQrCode, setCameraPermission, setPhotoQrCode } from "../../../../../test/expo-camera-fake";
import { pickNext } from "../../../../../test/expo-image-picker-fake";
import { testAccessToken } from "../../../../../test/jwt";
import { OFFLINE_STATE, ONLINE_STATE, setState as setNetworkState } from "../../../../../test/network-fake";
import { memorySecureStore } from "../../../../../test/secure-store-memory";
import TillScreen from "../../../../app/(app)/settings/till";
import { pairedTerminalOf, savePairedTerminal } from "../../../../contexts/pos";
import { checkoutRetryDelayMs, MAX_QUEUED_CHECKOUTS, parseCheckoutQueue, serializeCheckoutQueue, type QueuedCheckout } from "../../../../contexts/pos/checkout-queue";
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
const REWARD_ID = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
const FLAT_WHITE_OFFER = { type: "FREE_ITEM", quantity: 1, item: { name: "Flat white (8 oz)", sku: "BEV-FLATWHITE-8OZ" } };

function preview(overrides: Partial<{ valid: boolean; invalidReason: string | null; minSpendMinor: number | null }> = {}): ReturnType<typeof ok> {
	return ok({
		claimId: CLAIM_ID,
		rewardId: REWARD_ID,
		rewardTitle: "Free flat white",
		rewardDescription: "A free flat white with any breakfast set.",
		rewardType: "FREE_ITEM",
		offer: FLAT_WHITE_OFFER,
		termsConditions: "One per customer.",
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
			{
				redemptionId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
				claimId: CLAIM_ID,
				rewardId: REWARD_ID,
				rewardTitle: "Free flat white",
				rewardType: "FREE_ITEM",
				offer: FLAT_WHITE_OFFER,
			},
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

		await fireEvent.press(screen.getByRole("button", { name: "Scan with this app's camera" }));
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

	it("shows what it sent and what came back: request headers (key masked), request body, response body", async () => {
		stubApi({ "POST /integration/redemptions/validate": preview() });
		await renderPairedTill();

		await fireEvent.press(screen.getByRole("button", { name: "Scan with this app's camera" }));
		await scan(TOKEN);

		expect(await screen.findByText("What the till sent")).toBeOnTheScreen();
		const headers = screen.getByTestId("till-exchange-request-headers");
		expect(headers).toHaveTextContent(/"X-Terminal-Id": "TERM-7F3K9QX2"/u);
		expect(headers).toHaveTextContent(/"X-API-Key": "mk_liv••••••••"/u);
		expect(headers).not.toHaveTextContent(new RegExp(PAIRED.apiKey, "u"));
		expect(screen.getByTestId("till-exchange-request-body")).toHaveTextContent(new RegExp(`"token": "${TOKEN}"`, "u"));
		expect(screen.getByTestId("till-exchange-response-body")).toHaveTextContent(/"rewardTitle": "Free flat white"/u);
	});

	it("shows what the reward gives — the free item and its SKU — with its description and terms", async () => {
		stubApi({ "POST /integration/redemptions/validate": preview() });
		await renderPairedTill();

		await fireEvent.press(screen.getByRole("button", { name: "Scan with this app's camera" }));
		await scan(TOKEN);

		expect(await screen.findByText("A free flat white with any breakfast set.")).toBeOnTheScreen();
		expect(screen.getByText("1 × Flat white (8 oz) free")).toBeOnTheScreen();
		expect(screen.getByText("Flat white (8 oz)")).toBeOnTheScreen();
		expect(screen.getByText("BEV-FLATWHITE-8OZ")).toBeOnTheScreen();
		expect(screen.getByText("One per customer.")).toBeOnTheScreen();
	});

	it("puts the free item and its SKU on the receipt, and shows what the redeem call sent, line by line", async () => {
		stubApi({
			"POST /integration/redemptions/validate": preview(),
			"POST /integration/redemptions/checkout": dynamic((call) => receipt(2550, CheckoutBodySchema.parse(call.body).idempotencyKey)),
		});
		await renderPairedTill();
		await fireEvent.press(screen.getByRole("button", { name: "Scan with this app's camera" }));
		await scan(TOKEN);
		await fireEvent.changeText(await screen.findByLabelText("Bill total"), "25.50");
		await fireEvent.press(screen.getByRole("button", { name: "Redeem" }));

		const line = await screen.findByTestId("till-receipt-1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
		expect(line).toHaveTextContent(/1 × Flat white \(8 oz\) free/u);
		expect(line).toHaveTextContent(/BEV-FLATWHITE-8OZ/u);
		expect(screen.getByText("What the till sent to redeem it")).toBeOnTheScreen();
		const body = screen.getByTestId("till-checkout-exchange-request-body");
		expect(body).toHaveTextContent(/"billTotalMinor": 2550/u);
		expect(body).toHaveTextContent(/"currency": "MYR"/u);
		expect(body).toHaveTextContent(/"idempotencyKey": "[0-9a-f-]{36}"/u);
		expect(screen.getByTestId("till-checkout-exchange-response-body")).toHaveTextContent(/"sku": "BEV-FLATWHITE-8OZ"/u);
		expect(screen.getByTestId("till-checkout-exchange-request-body-line-numbers", { includeHiddenElements: true })).toHaveTextContent(/^1\s2\s3\s4\s5\s6/u);
	});

	it("offers Google's scanner and the app's own camera, disabling Google's on a phone without Play services", async () => {
		stubApi({});
		await renderPairedTill();

		expect(screen.getByRole("button", { name: "Scan with Google scanner" })).toBeDisabled();
		expect(screen.getByText(/Google's scanner isn't available on this phone/u)).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Scan with this app's camera" })).toBeEnabled();
	});

	it("opens the app's own camera scanner, with Scan from gallery inside it", async () => {
		stubApi({});
		await renderPairedTill();

		await fireEvent.press(screen.getByRole("button", { name: "Scan with this app's camera" }));

		expect(await screen.findByTestId("till-camera-scanner-gallery")).toHaveAccessibleName("Scan from gallery");
	});

	it("numbers the lines of each JSON block", async () => {
		stubApi({ "POST /integration/redemptions/validate": preview() });
		await renderPairedTill();
		await fireEvent.press(screen.getByRole("button", { name: "Scan with this app's camera" }));
		await scan(TOKEN);

		expect(await screen.findByTestId("till-exchange-request-body-line-numbers", { includeHiddenElements: true })).toHaveTextContent("1\n2\n3");
	});

	it("shows the API's error answer in the response body", async () => {
		stubApi({ "POST /integration/redemptions/validate": fail(422, "REDEMPTION_CODE_INVALID", "This code is not valid") });
		await renderPairedTill();

		await fireEvent.press(screen.getByRole("button", { name: "Scan with this app's camera" }));
		await scan(TOKEN);

		expect(await screen.findByTestId("till-exchange-response-body")).toHaveTextContent(/"code": "REDEMPTION_CODE_INVALID"/u);
	});

	it("reads the customer's QR from a photo in the gallery", async () => {
		const api = stubApi({ "POST /integration/redemptions/validate": preview() });
		await renderPairedTill();
		setPhotoQrCode(TOKEN);
		pickNext({
			uri: "file:///photos/qr.jpg",
			width: 640,
			height: 640,
			type: "image",
			fileName: "qr.jpg",
			fileSize: 1000,
			mimeType: "image/jpeg",
			assetId: null,
			base64: null,
			exif: null,
			duration: null,
		});

		await fireEvent.press(screen.getByTestId("till-scan-gallery"));

		expect(await screen.findByText("Free flat white")).toBeOnTheScreen();
		expect(api.callsTo("POST /integration/redemptions/validate").at(0)?.body).toBe(JSON.stringify({ token: TOKEN }));
	});

	it("retries a failed checkout with the same idempotency key, so the reward is redeemed once", async () => {
		const answers = [fail(503, "SERVICE_UNAVAILABLE", "Try again in a moment")];
		const api = stubApi({
			"POST /integration/redemptions/validate": preview(),
			"POST /integration/redemptions/checkout": dynamic((call) => answers.shift() ?? receipt(2550, CheckoutBodySchema.parse(call.body).idempotencyKey)),
		});
		await renderPairedTill();
		await fireEvent.press(screen.getByRole("button", { name: "Scan with this app's camera" }));
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

		await fireEvent.press(screen.getByRole("button", { name: "Scan with this app's camera" }));
		await scan(TOKEN);

		expect(await screen.findByText("This reward has expired.")).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Redeem" })).toBeNull();
		expect(api.callsTo("POST /integration/redemptions/checkout")).toHaveLength(0);
	});

	it("holds a bill under the reward's minimum spend before sending it", async () => {
		const api = stubApi({ "POST /integration/redemptions/validate": preview({ minSpendMinor: 3000 }) });
		await renderPairedTill();
		await fireEvent.press(screen.getByRole("button", { name: "Scan with this app's camera" }));
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

		await fireEvent.press(screen.getByRole("button", { name: "Scan with this app's camera" }));
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

	describe("offline (enhancement 6.4)", () => {
		/** Scans the customer's code and enters a RM 25.50 bill, ready to redeem. */
		async function readyToRedeem(): Promise<void> {
			await renderPairedTill();
			await fireEvent.press(screen.getByRole("button", { name: "Scan with this app's camera" }));
			await scan(TOKEN);
			await fireEvent.changeText(await screen.findByLabelText("Bill total"), "25.50");
		}

		function storedQueue(): readonly QueuedCheckout[] {
			// Secure Store keeps every value as JSON: the queue's own JSON is stored as a JSON string.
			const raw = memorySecureStore.peek(SECURE_STORE_ENTRIES.tillCheckoutQueue.key);
			return parseCheckoutQueue(raw === null ? null : z.string().parse(JSON.parse(raw)));
		}

		it("keeps a checkout that got no answer, with its key, and sends it when the connection is back", async () => {
			const answers: StubAnswer[] = [UNREACHABLE];
			const api = stubApi({
				"POST /integration/redemptions/validate": preview(),
				"POST /integration/redemptions/checkout": dynamic((call) => answers.shift() ?? receipt(2550, CheckoutBodySchema.parse(call.body).idempotencyKey)),
			});
			await readyToRedeem();

			await fireEvent.press(screen.getByRole("button", { name: "Redeem" }));

			expect(await screen.findByText("Saved on this till")).toBeOnTheScreen();
			expect(screen.getByText("RM 25.50 bill · waiting to send")).toBeOnTheScreen();
			expect(storedQueue()).toHaveLength(1);

			await act(async (): Promise<void> => {
				setNetworkState(OFFLINE_STATE);
				await Promise.resolve();
			});
			await act(async (): Promise<void> => {
				setNetworkState(ONLINE_STATE);
				await Promise.resolve();
			});

			expect(await screen.findByText("Free flat white redeemed on a RM 25.50 bill (sent when the connection came back).")).toBeOnTheScreen();
			await waitFor(() => {
				expect(screen.queryByTestId("till-checkout-queue")).toBeNull();
			});
			const [first, second] = api.callsTo("POST /integration/redemptions/checkout").map((call) => CheckoutBodySchema.parse(call.body).idempotencyKey);
			expect(second).toBe(first);
			expect(storedQueue()).toStrictEqual([]);
		});

		it("tries again by itself when the first send after reconnecting gets no answer (mobile data came up before Wi-Fi)", async () => {
			// Seen on a phone (2026-11-05): leaving airplane mode, Android made mobile data the default network a third of
			// a second before Wi-Fi, the app counted as online, and the send to the API's Wi-Fi-only address got no answer.
			const answers: StubAnswer[] = [UNREACHABLE, UNREACHABLE];
			const api = stubApi({
				"POST /integration/redemptions/validate": preview(),
				"POST /integration/redemptions/checkout": dynamic((call) => answers.shift() ?? receipt(2550, CheckoutBodySchema.parse(call.body).idempotencyKey)),
			});
			await readyToRedeem();
			await fireEvent.press(screen.getByRole("button", { name: "Redeem" }));
			await screen.findByText("Saved on this till");

			jest.useFakeTimers();
			try {
				await act(async (): Promise<void> => {
					setNetworkState(OFFLINE_STATE);
					await Promise.resolve();
				});
				await act(async (): Promise<void> => {
					setNetworkState(ONLINE_STATE);
					await Promise.resolve();
				});
				expect(api.callsTo("POST /integration/redemptions/checkout")).toHaveLength(2);
				expect(screen.getByText("RM 25.50 bill · waiting to send")).toBeOnTheScreen();

				await act(async (): Promise<void> => {
					await jest.advanceTimersByTimeAsync(checkoutRetryDelayMs(0));
				});
			} finally {
				jest.useRealTimers();
			}

			expect(await screen.findByText("Free flat white redeemed on a RM 25.50 bill (sent when the connection came back).")).toBeOnTheScreen();
			const keys = api.callsTo("POST /integration/redemptions/checkout").map((call) => CheckoutBodySchema.parse(call.body).idempotencyKey);
			expect(keys).toHaveLength(3);
			expect(new Set(keys).size).toBe(1);
			expect(storedQueue()).toStrictEqual([]);
		});

		it("stops trying again while the phone is offline", async () => {
			const api = stubApi({ "POST /integration/redemptions/validate": preview(), "POST /integration/redemptions/checkout": UNREACHABLE });
			await readyToRedeem();
			await fireEvent.press(screen.getByRole("button", { name: "Redeem" }));
			await screen.findByText("Saved on this till");

			jest.useFakeTimers();
			try {
				await act(async (): Promise<void> => {
					setNetworkState(OFFLINE_STATE);
					await Promise.resolve();
				});
				await act(async (): Promise<void> => {
					setNetworkState(ONLINE_STATE);
					await Promise.resolve();
				});
				await act(async (): Promise<void> => {
					setNetworkState(OFFLINE_STATE);
					await Promise.resolve();
				});
				const before = api.callsTo("POST /integration/redemptions/checkout").length;
				await act(async (): Promise<void> => {
					await jest.advanceTimersByTimeAsync(checkoutRetryDelayMs(Number.MAX_SAFE_INTEGER));
				});
				expect(api.callsTo("POST /integration/redemptions/checkout")).toHaveLength(before);
			} finally {
				jest.useRealTimers();
			}
		});

		it("turns the saved notice into the receipt once its redemption is sent (seen on a phone, 2026-11-05)", async () => {
			const answers: StubAnswer[] = [UNREACHABLE];
			stubApi({
				"POST /integration/redemptions/validate": preview(),
				"POST /integration/redemptions/checkout": dynamic((call) => answers.shift() ?? receipt(2550, CheckoutBodySchema.parse(call.body).idempotencyKey)),
			});
			await readyToRedeem();
			await fireEvent.press(screen.getByRole("button", { name: "Redeem" }));
			await screen.findByText("Saved on this till");

			await fireEvent.press(screen.getByRole("button", { name: "Send now" }));

			expect(await screen.findByText("Redeemed")).toBeOnTheScreen();
			expect(screen.queryByText("Saved on this till")).toBeNull();
			expect(screen.queryByText(/There's no connection/u)).toBeNull();
			// What the till sent and got back is the send that went through, not the attempt with no connection.
			const response = screen.getByTestId("till-checkout-exchange-response-body");
			expect(response).not.toHaveTextContent(/Network request failed/u);
			expect(response).toHaveTextContent(/"saleId"/u);
		});

		it("leaves the saved notice for the ready screen when its redemption is refused, the refusal listed", async () => {
			const answers: StubAnswer[] = [UNREACHABLE, fail(409, "CLAIM_ALREADY_REDEEMED", "This reward was already redeemed")];
			stubApi({
				"POST /integration/redemptions/validate": preview(),
				"POST /integration/redemptions/checkout": dynamic((call) => answers.shift() ?? receipt(2550, CheckoutBodySchema.parse(call.body).idempotencyKey)),
			});
			await readyToRedeem();
			await fireEvent.press(screen.getByRole("button", { name: "Redeem" }));
			await screen.findByText("Saved on this till");

			await fireEvent.press(screen.getByRole("button", { name: "Send now" }));

			expect(await screen.findByText("Not redeemed: This reward was already redeemed")).toBeOnTheScreen();
			expect(screen.queryByText("Saved on this till")).toBeNull();
			expect(screen.getByRole("button", { name: "Check code" })).toBeOnTheScreen();
		});

		it("lists a kept checkout the API refused when sent, until the cashier dismisses it", async () => {
			const answers: StubAnswer[] = [UNREACHABLE, fail(409, "CLAIM_ALREADY_REDEEMED", "This reward was already redeemed")];
			stubApi({
				"POST /integration/redemptions/validate": preview(),
				"POST /integration/redemptions/checkout": dynamic((call) => answers.shift() ?? receipt(2550, CheckoutBodySchema.parse(call.body).idempotencyKey)),
			});
			await readyToRedeem();
			await fireEvent.press(screen.getByRole("button", { name: "Redeem" }));
			await screen.findByText("Saved on this till");

			await fireEvent.press(screen.getByRole("button", { name: "Send now" }));

			expect(await screen.findByText("Not redeemed: This reward was already redeemed")).toBeOnTheScreen();
			await fireEvent.press(screen.getByRole("button", { name: "Dismiss Free flat white" }));
			await waitFor(() => {
				expect(screen.queryByTestId("till-checkout-queue")).toBeNull();
			});
		});

		it("never keeps a checkout the API answered: its refusal shows at once", async () => {
			stubApi({
				"POST /integration/redemptions/validate": preview(),
				"POST /integration/redemptions/checkout": fail(422, "MIN_SPEND_NOT_MET", "The bill is under the minimum spend"),
			});
			await readyToRedeem();
			await fireEvent.press(screen.getByRole("button", { name: "Redeem" }));

			expect(await screen.findByText("The bill is under the minimum spend")).toBeOnTheScreen();
			expect(screen.queryByText("Saved on this till")).toBeNull();
			expect(storedQueue()).toStrictEqual([]);
		});

		it("keeps no more than it can hold, and says so", async () => {
			const full: readonly QueuedCheckout[] = Array.from({ length: MAX_QUEUED_CHECKOUTS }, (_unused: undefined, index: number): QueuedCheckout => ({
				request: { idempotencyKey: `0a1b2c3d-4e5f-4a6b-8c7d-00000000000${String(index)}`, billTotalMinor: 1000, currency: "MYR", codes: [{ token: TOKEN }] },
				rewardTitle: "Free flat white",
				queuedAtMs: CLAIM_EXPIRES_AT,
				refusal: "Already used",
			}));
			memorySecureStore.seed(SECURE_STORE_ENTRIES.tillCheckoutQueue.key, JSON.stringify(serializeCheckoutQueue(full)));
			stubApi({ "POST /integration/redemptions/validate": preview(), "POST /integration/redemptions/checkout": UNREACHABLE });
			await readyToRedeem();
			await fireEvent.press(screen.getByRole("button", { name: "Redeem" }));

			expect(
				await screen.findByText(`This till already holds ${String(MAX_QUEUED_CHECKOUTS)} redemptions waiting for the connection. Reconnect before redeeming more.`),
			).toBeOnTheScreen();
		});
	});
});
