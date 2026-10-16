// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { LockoutCountdown } from "./lockout-countdown";

const LABELS = UI_KIT_LABELS_EN.lockoutCountdown;

/** The locked readout for a clock value, as the English pack words it. */
function locked(clock: string): string {
	return `${LABELS.lockedPrefix} ${clock}`;
}
const ONE_SECOND_MS = 1000;

beforeEach((): void => {
	vi.useFakeTimers();
});

afterEach((): void => {
	cleanup();
	vi.useRealTimers();
});

describe("LockoutCountdown", () => {
	it("ticks down once per second when uncontrolled", (): void => {
		render(<LockoutCountdown remainingSeconds={65} />, { wrapper: UiKitTestProviders });
		expect(screen.getByText(locked("01:05"))).toBeTruthy();
		act((): void => {
			vi.advanceTimersByTime(ONE_SECOND_MS);
		});
		expect(screen.getByText(locked("01:04"))).toBeTruthy();
	});

	it("renders the parent's secondsLeft and does not tick when controlled", (): void => {
		const { rerender } = render(<LockoutCountdown remainingSeconds={65} secondsLeft={30} />, { wrapper: UiKitTestProviders });
		expect(screen.getByText(locked("00:30"))).toBeTruthy();
		act((): void => {
			vi.advanceTimersByTime(ONE_SECOND_MS);
		});
		expect(screen.getByText(locked("00:30"))).toBeTruthy();

		rerender(<LockoutCountdown remainingSeconds={65} secondsLeft={0} />);
		expect(screen.getByText(LABELS.lockedExpired)).toBeTruthy();
	});

	it("shows the true time left when the tab comes back, not the original duration", (): void => {
		const hiddenForSeconds = 40;
		render(<LockoutCountdown remainingSeconds={65} />, { wrapper: UiKitTestProviders });

		// A hidden tab's timers are throttled: the clock moves on while no tick runs here.
		act((): void => {
			vi.setSystemTime(Date.now() + hiddenForSeconds * ONE_SECOND_MS);
			document.dispatchEvent(new Event("visibilitychange"));
		});

		expect(screen.getByText(locked("00:25"))).toBeTruthy();
	});

	it("reaches the expired label at the deadline even if ticks were skipped", (): void => {
		render(<LockoutCountdown remainingSeconds={3} />, { wrapper: UiKitTestProviders });
		act((): void => {
			vi.setSystemTime(Date.now() + 10 * ONE_SECOND_MS);
			vi.advanceTimersByTime(ONE_SECOND_MS);
		});
		expect(screen.getByText(LABELS.lockedExpired)).toBeTruthy();
	});

	it("restarts from a new remainingSeconds (a fresh lockout)", (): void => {
		const { rerender } = render(<LockoutCountdown remainingSeconds={65} />, { wrapper: UiKitTestProviders });
		act((): void => {
			vi.advanceTimersByTime(5 * ONE_SECOND_MS);
		});
		expect(screen.getByText(locked("01:00"))).toBeTruthy();

		rerender(<LockoutCountdown remainingSeconds={120} />);
		expect(screen.getByText(locked("02:00"))).toBeTruthy();
		act((): void => {
			vi.advanceTimersByTime(ONE_SECOND_MS);
		});
		expect(screen.getByText(locked("01:59"))).toBeTruthy();
	});

	it("forwards its ref to the status paragraph", (): void => {
		const ref = React.createRef<HTMLParagraphElement>();
		render(<LockoutCountdown ref={ref} remainingSeconds={5} />, { wrapper: UiKitTestProviders });
		expect(ref.current?.dataset.slot).toBe("lockout-countdown");
	});
});
