// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClaimHoldCountdown } from "../claim-hold-countdown";

const NOW = 1_800_000_000_000;

describe("ClaimHoldCountdown", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("counts down and says when the hold has ended, once", () => {
		const onExpired = vi.fn();
		render(<ClaimHoldCountdown holdExpiresAt={NOW + 2_000} onExpired={onExpired} />);
		expect(screen.getByRole("timer").textContent).toContain("0:02");

		act(() => {
			vi.advanceTimersByTime(1_000);
		});
		expect(screen.getByRole("timer").textContent).toContain("0:01");
		expect(onExpired).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(5_000);
		});
		expect(onExpired).toHaveBeenCalledTimes(1);
	});
});
