// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { didTokenRotate, SessionStatusView } from "./session-status-badge";

afterEach(() => {
	cleanup();
});

describe("SessionStatusView", () => {
	it("renders a pulsing 'checking' pill while loading", () => {
		render(<SessionStatusView status="loading" />);

		expect(screen.getByLabelText("Session status: checking")).toBeTruthy();
		expect(screen.getByText("Checking session…")).toBeTruthy();
	});

	it("renders a destructive pill when the check fails", () => {
		render(<SessionStatusView status="error" errorMessage="Session check failed — please log in again" />);

		expect(screen.getByLabelText("Session status: error")).toBeTruthy();
		expect(screen.getByText("Session check failed — please log in again")).toBeTruthy();
	});

	it("renders identity + a formatted token countdown when verified", () => {
		render(<SessionStatusView status="ready" email="admin@example.com" fullName="Alex Morgan" secondsLeft={125} />);

		expect(screen.getByLabelText("Session status: verified")).toBeTruthy();
		expect(screen.getByText("Alex Morgan")).toBeTruthy();
		expect(screen.getByText("admin@example.com")).toBeTruthy();
		expect(screen.getByText(/Token expires in 2m 05s/)).toBeTruthy();
	});

	it("formats a sub-minute countdown correctly", () => {
		render(<SessionStatusView status="ready" email="a@b.com" fullName="Dev" secondsLeft={9} />);

		expect(screen.getByText(/Token expires in 0m 09s/)).toBeTruthy();
	});

	it("never shows a negative countdown", () => {
		render(<SessionStatusView status="ready" email="a@b.com" fullName="Dev" secondsLeft={-5} />);

		expect(screen.getByText(/Token expires in 0m 00s/)).toBeTruthy();
	});

	it("falls back to 'Token expiry unknown' when secondsLeft is omitted", () => {
		render(<SessionStatusView status="ready" email="a@b.com" fullName="Dev" />);

		// The fallback shares a span with the interpunct separator, so match the text.
		expect(screen.getByText(/Token expiry unknown/)).toBeTruthy();
	});

	it("shows 'Refreshed just now' instead of the countdown while refreshed", () => {
		render(<SessionStatusView status="ready" email="admin@example.com" fullName="Alex Morgan" secondsLeft={125} refreshed />);

		expect(screen.getByLabelText("Session status: verified")).toBeTruthy();
		// The label shares a span with the interpunct separator, so match the text.
		expect(screen.getByText(/Refreshed just now/)).toBeTruthy();
		// The countdown is replaced, not shown alongside the pulse.
		expect(screen.queryByText(/Token expires in/)).toBeNull();
	});

	it("renders the pulse ring class while refreshed", () => {
		const { container } = render(<SessionStatusView status="ready" email="a@b.com" fullName="Dev" refreshed />);

		expect(container.querySelector("[data-slot=badge]")?.getAttribute("class") ?? "").toContain("ring-2");
	});

	it("does not show the pulse by default", () => {
		render(<SessionStatusView status="ready" email="a@b.com" fullName="Dev" secondsLeft={60} />);

		expect(screen.queryByText("Refreshed just now")).toBeNull();
		expect(screen.getByText(/Token expires in 1m 00s/)).toBeTruthy();
	});
});

describe("didTokenRotate", () => {
	it("is false when either side is null (first sighting or unknown expiry)", () => {
		expect(didTokenRotate(null, "2026-08-04T12:34:56.000Z")).toBe(false);
		expect(didTokenRotate("2026-08-04T12:00:00.000Z", null)).toBe(false);
		expect(didTokenRotate(null, null)).toBe(false);
	});

	it("is false when the expiry did not change", () => {
		expect(didTokenRotate("2026-08-04T12:34:56.000Z", "2026-08-04T12:34:56.000Z")).toBe(false);
	});

	it("is false when the new expiry is earlier (shouldn't happen, but never pulse on it)", () => {
		expect(didTokenRotate("2026-08-04T13:00:00.000Z", "2026-08-04T12:00:00.000Z")).toBe(false);
	});

	it("is true when the new expiry jumps forward (a real rotation)", () => {
		expect(didTokenRotate("2026-08-04T12:00:00.000Z", "2026-08-04T12:15:00.000Z")).toBe(true);
	});

	it("handles offset-bearing timestamps (DateStringSchema allows +08:00)", () => {
		// Same instant, different representations → not a rotation.
		expect(didTokenRotate("2026-08-04T04:34:56.000Z", "2026-08-04T12:34:56.000+08:00")).toBe(false);
		// A later instant written with an offset → rotation.
		expect(didTokenRotate("2026-08-04T04:00:00.000Z", "2026-08-04T12:15:00.000+08:00")).toBe(true);
	});
});
