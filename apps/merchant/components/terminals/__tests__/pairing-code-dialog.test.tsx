// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { buildPosPairingQrPayload, encodeQr, POS_PAIRING_CODE_TTL_MS, PosPairingQrPayloadSchema, qrMatrixToSvgPath } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PAIRING_QR_CAPTION, PAIRING_QR_SIZE_PX, PairingCodeDialog } from "@/components/terminals/pairing-code-dialog";
import { buildPairing, buildTerminal, TERMINAL_FIXTURE_NOW } from "@/test/terminals";

const API = "https://api.example.com/";
const PAIRING = buildPairing(buildTerminal({ name: "Front till" }), "KX7M2PQR");

function renderDialog(isPaired = false): void {
	render(
		<UiKitTestProviders>
			<PairingCodeDialog pairing={PAIRING} onOpenChange={vi.fn()} isPaired={isPaired} apiBaseUrl={API} onNewCode={vi.fn()} isIssuingCode={false} />
		</UiKitTestProviders>,
	);
}

function dialog(): HTMLElement {
	return screen.getByRole("dialog");
}

beforeEach((): void => {
	vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
	vi.setSystemTime(TERMINAL_FIXTURE_NOW);
});

afterEach((): void => {
	cleanup();
	vi.useRealTimers();
});

describe("PairingCodeDialog pairing QR", () => {
	it("shows a QR of the versioned pairing payload while the code is live, with the caption", () => {
		renderDialog();

		const qrCode = within(dialog()).getByRole("img", { name: "Pairing QR code for Front till" });
		const expected = qrMatrixToSvgPath(encodeQr(buildPosPairingQrPayload(PAIRING.pairingCode)), { quietZoneModules: 0 });
		expect(qrCode.querySelector("path")?.getAttribute("d")).toBe(expected.path);
		expect(qrCode.querySelector("svg")?.getAttribute("width")).toBe(String(PAIRING_QR_SIZE_PX));
		expect(within(dialog()).getByText(PAIRING_QR_CAPTION)).toBeTruthy();
		// The code stays readable to type in, next to the QR.
		expect(within(dialog()).getByText("KX7M 2PQR")).toBeTruthy();
	});

	it("encodes a payload a till's scanner parses back to this exact code", () => {
		expect(PosPairingQrPayloadSchema.parse(buildPosPairingQrPayload(PAIRING.pairingCode))).toBe(PAIRING.pairingCode);
	});

	it("removes the QR once the code has expired", () => {
		renderDialog();
		act((): void => {
			vi.advanceTimersByTime(POS_PAIRING_CODE_TTL_MS);
		});

		expect(within(dialog()).queryByRole("img", { name: "Pairing QR code for Front till" })).toBeNull();
		expect(within(dialog()).queryByText(PAIRING_QR_CAPTION)).toBeNull();
	});

	it("shows no QR once the till has paired", () => {
		renderDialog(true);

		expect(within(dialog()).queryByRole("img", { name: "Pairing QR code for Front till" })).toBeNull();
	});
});
