// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MeasuredNetworkQuality, NetworkQualityReading } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { NetworkQualityIndicator } from "../network-quality-indicator";

const MEASURED_AT_MS = 1_791_504_000_000;

afterEach((): void => {
	cleanup();
});

function measured(quality: Omit<MeasuredNetworkQuality, "kind">): NetworkQualityReading {
	return { status: "measured", quality: { kind: "measured", ...quality }, measuredAtMs: MEASURED_AT_MS };
}

function renderIndicator(reading: NetworkQualityReading, testing = false): { readonly onTestAgain: () => void; readonly trigger: HTMLElement } {
	const onTestAgain = vi.fn();
	render(<NetworkQualityIndicator reading={reading} testing={testing} onTestAgain={onTestAgain} />, { wrapper: UiKitTestProviders });
	return { onTestAgain, trigger: screen.getByRole("button", { name: /^Connection:/u }) };
}

describe("NetworkQualityIndicator", () => {
	it.each([
		["strong", "success", { pingMs: 42, jitterMs: 3, lossPercent: 0, strength: "strong" }],
		["moderate", "warning", { pingMs: 180, jitterMs: 12, lossPercent: 0, strength: "moderate" }],
		["weak", "danger", { pingMs: 640, jitterMs: 90, lossPercent: 25, strength: "weak" }],
	] satisfies [string, string, Omit<MeasuredNetworkQuality, "kind">][])("colours a %s connection %s and shows its ping in the pill", (strength, tone, quality) => {
		const { trigger } = renderIndicator(measured(quality));
		expect(trigger.dataset.tone).toBe(tone);
		expect(trigger.textContent).toBe(`${String(quality.pingMs)} ms`);
		expect(trigger.getAttribute("aria-label")).toBe(`Connection: ${strength.charAt(0).toUpperCase()}${strength.slice(1)}, ${String(quality.pingMs)} ms. Show details`);
	});

	it("opens a panel with the ping, jitter and packet loss of the last test", () => {
		const { trigger } = renderIndicator(measured({ pingMs: 42, jitterMs: 3, lossPercent: 0, strength: "strong" }));
		fireEvent.click(trigger);
		expect(screen.getByRole("heading", { name: "Strong connection" })).toBeDefined();
		const metrics = [...document.querySelectorAll("dl > div")].map((metric) => metric.textContent);
		expect(metrics).toEqual(["Ping42ms", "Jitter3ms", "Packet loss0%"]);
		expect(screen.getByText(/^Tested at /u)).toBeDefined();
	});

	it("re-tests on request, and cannot start a second test while one runs", () => {
		const idle = renderIndicator(measured({ pingMs: 42, jitterMs: 3, lossPercent: 0, strength: "strong" }));
		fireEvent.click(idle.trigger);
		fireEvent.click(screen.getByRole("button", { name: "Test again" }));
		expect(idle.onTestAgain).toHaveBeenCalledTimes(1);
		cleanup();

		const running = renderIndicator(measured({ pingMs: 42, jitterMs: 3, lossPercent: 0, strength: "strong" }), true);
		fireEvent.click(running.trigger);
		expect(screen.getByRole("button", { name: "Testing…" }).hasAttribute("disabled")).toBe(true);
	});

	it("pulses, muted, until the first test finishes", () => {
		const { trigger } = renderIndicator({ status: "measuring" }, true);
		expect(trigger.dataset.tone).toBe("muted");
		expect(trigger.textContent).toBe("Measuring…");
		expect(trigger.className).toContain("motion-safe:animate-pulse");
	});

	it("is red when offline, and offers no test until the device is back online", () => {
		const { trigger } = renderIndicator({ status: "offline" });
		expect(trigger.dataset.tone).toBe("danger");
		expect(trigger.textContent).toBe("Offline");
		fireEvent.click(trigger);
		expect(screen.getByRole("heading", { name: "You're offline" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Test again" }).hasAttribute("disabled")).toBe(true);
	});

	it("is red when the server did not answer, without figures to show", () => {
		const { trigger } = renderIndicator({ status: "unreachable", measuredAtMs: MEASURED_AT_MS });
		expect(trigger.dataset.tone).toBe("danger");
		expect(trigger.textContent).toBe("No response");
		fireEvent.click(trigger);
		expect(screen.getByRole("heading", { name: "The server isn't answering" })).toBeDefined();
		expect(document.querySelector("dl")).toBeNull();
	});
});
