// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// `didTokenRotate` lives with the stream pipeline (lib/session-badge.ts); the
// component file only exports the presentational view.
import { epochMs } from "@workspace/shared";

import { didTokenRotate } from "@/lib/session-status-badge";
import { SessionStatusView } from "./session-status-badge";

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

	it("compact hides the identity and shows just the countdown", () => {
		render(<SessionStatusView status="ready" email="admin@example.com" fullName="Alex Morgan" secondsLeft={125} compact />);

		expect(screen.getByLabelText("Session status: verified")).toBeTruthy();
		// Identity is hidden — the topbar profile dropdown already shows it.
		expect(screen.queryByText("Alex Morgan")).toBeNull();
		expect(screen.queryByText("admin@example.com")).toBeNull();
		// Countdown stays, without the "Token expires in" prefix.
		expect(screen.getByText("2m 05s")).toBeTruthy();
	});

	it("compact formats long expiries as hours and minutes", () => {
		render(<SessionStatusView status="ready" email="a@b.com" fullName="Dev" secondsLeft={7530} compact />);

		expect(screen.getByText("2h 05m")).toBeTruthy();
	});

	it("compact shows a short pulse label and short loading/error text", () => {
		render(<SessionStatusView status="ready" email="a@b.com" fullName="Dev" secondsLeft={125} refreshed compact />);
		expect(screen.getByText("Refreshed")).toBeTruthy();

		render(<SessionStatusView status="loading" compact />);
		expect(screen.getByText("Checking…")).toBeTruthy();

		render(<SessionStatusView status="error" errorMessage="Session expired — please log in again" compact />);
		// Compact still surfaces the REAL message (401 vs network distinction matters).
		expect(screen.getByText("Session expired — please log in again")).toBeTruthy();
	});
});

describe("didTokenRotate", () => {
	// Epoch ms for `2026-08-04T12:00:00.000Z` (the reference instant used below).
	const T12: number = epochMs(Date.parse("2026-08-04T12:00:00.000Z"));

	it("is false when either side is null (first sighting or unknown expiry)", () => {
		expect(didTokenRotate(null, T12)).toBe(false);
		expect(didTokenRotate(T12, null)).toBe(false);
		expect(didTokenRotate(null, null)).toBe(false);
	});

	it("is false when the expiry did not change", () => {
		expect(didTokenRotate(T12, T12)).toBe(false);
	});

	it("is false when the new expiry is earlier (shouldn't happen, but never pulse on it)", () => {
		expect(didTokenRotate(epochMs(T12 + 3_600_000), T12)).toBe(false);
	});

	it("is true when the new expiry jumps forward (a real rotation)", () => {
		expect(didTokenRotate(T12, epochMs(T12 + 900_000))).toBe(true);
	});

	it("compares epoch instants (offsets are already normalized server-side)", () => {
		// Same instant, different representations → not a rotation.
		const sameInstantA: number = epochMs(Date.parse("2026-08-04T04:34:56.000Z"));
		const sameInstantB: number = epochMs(Date.parse("2026-08-04T12:34:56.000+08:00"));
		expect(didTokenRotate(sameInstantA, sameInstantB)).toBe(false);
		// A later instant → rotation.
		expect(didTokenRotate(sameInstantA, epochMs(sameInstantA + 900_000))).toBe(true);
	});
});
