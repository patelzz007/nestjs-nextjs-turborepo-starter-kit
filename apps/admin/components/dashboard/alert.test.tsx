// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Alert, AlertAction, AlertGroup, alertA11yProps } from "@workspace/ui/components/alert";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("Alert", () => {
	it("renders title + description and exposes role=status by default (improvement 3)", () => {
		render(
			<Alert variant="info" title="Heads up" description="Maintenance at 02:00 UTC">
				extra
			</Alert>,
		);
		expect(screen.getByText("Heads up")).toBeTruthy();
		expect(screen.getByText("Maintenance at 02:00 UTC")).toBeTruthy();
		expect(screen.getByText("extra")).toBeTruthy();
		expect(screen.getByText("Heads up").closest("[data-slot='alert']")?.getAttribute("role")).toBe("status");
	});

	it("uses role=alert + assertive for destructive variants (improvement 3 + 14)", () => {
		render(<Alert variant="destructive" title="Failed" description="Refresh failed" />);
		const root = screen.getByText("Failed").closest("[data-slot='alert']");
		expect(root?.getAttribute("role")).toBe("alert");
		expect(root?.getAttribute("aria-live")).toBe("assertive");
	});

	it("respects an explicit role override (improvement 3)", () => {
		render(<Alert variant="destructive" title="T" role="status" liveRegion="polite" />);
		const root = screen.getByText("T").closest("[data-slot='alert']");
		expect(root?.getAttribute("role")).toBe("status");
		expect(root?.getAttribute("aria-live")).toBe("polite");
	});

	it("renders a dismiss button that fires onDismiss (improvement 6)", () => {
		const onDismiss = vi.fn();
		render(<Alert variant="warning" title="W" dismissible onDismiss={onDismiss} />);
		fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("auto-dismisses after duration (feature 1)", () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();
		render(<Alert variant="success" title="S" duration={500} onDismiss={onDismiss} />);
		vi.advanceTimersByTime(600);
		expect(onDismiss).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});

	it("manual dismissal cancels the pending auto-dismiss timer (reviewer fix)", () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();
		render(<Alert variant="success" title="S" duration={10000} dismissible onDismiss={onDismiss} />);
		fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
		vi.advanceTimersByTime(12000);
		expect(onDismiss).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});

	it("renders a progress bar with the clamped width (feature 11)", () => {
		render(<Alert variant="success" title="U" progress={200} />);
		const bar = screen.getByRole("progressbar");
		expect(bar.getAttribute("aria-valuenow")).toBe("200");
		expect(bar.firstElementChild?.getAttribute("style")).toContain("width: 100%");
	});

	it("renders multi-line errors as a list (feature 13)", () => {
		render(<Alert variant="destructive" title="E" errors={["first", "second"]} />);
		expect(screen.getAllByRole("listitem")).toHaveLength(2);
	});

	it("hides the body when collapsible and closed, toggles on the header (feature 6)", () => {
		render(<Alert variant="info" title="C" description="hidden body" collapsible defaultOpen={false} />);
		expect(screen.queryByText("hidden body")).toBeNull();
		fireEvent.click(screen.getByRole("button"));
		expect(screen.getByText("hidden body")).toBeTruthy();
	});

	it("persists dismissal to sessionStorage under storageKey (feature 14)", () => {
		const setItem = vi.spyOn(window.sessionStorage.__proto__, "setItem");
		render(<Alert variant="info" title="P" dismissible storageKey="alert-demo" onDismiss={vi.fn()} />);
		fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
		expect(setItem).toHaveBeenCalledWith("alert-demo", "dismissed");
	});

	it("hides the alert entirely once dismissed (feature 14)", () => {
		render(<Alert variant="info" title="Gone" dismissible onDismiss={vi.fn()} />);
		fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
		expect(screen.queryByText("Gone")).toBeNull();
	});

	it("wires aria-describedby to the description id (improvement 19)", () => {
		render(<Alert variant="destructive" title="F" description="email is required" descriptionId="email-error" />);
		const root = screen.getByText("F").closest("[data-slot='alert']");
		expect(root?.getAttribute("aria-describedby")).toBe("email-error");
		expect(screen.getByText("email is required").closest("[data-slot='alert-description']")?.id).toBe("email-error");
	});

	it("renders an AlertAction with an accessible label (improvement 7)", () => {
		render(
			<Alert variant="warning" title="W">
				<AlertAction actionLabel="Inspect">Inspect</AlertAction>
			</Alert>,
		);
		expect(screen.getByRole("button", { name: "Inspect" })).toBeTruthy();
	});

	it("AlertGroup renders a container and supports floating (feature 12)", () => {
		const { container } = render(
			<AlertGroup floating>
				<Alert variant="info" title="A" />
			</AlertGroup>,
		);
		const group = container.querySelector("[data-slot='alert-group']");
		expect(group).toBeTruthy();
		expect(group?.className).toContain("fixed");
	});

	it("alertA11yProps computes the ARIA contract (feature 20)", () => {
		expect(alertA11yProps("destructive")).toEqual({ role: "alert", liveRegion: "assertive", label: "Error" });
		expect(alertA11yProps("info", "Custom")).toEqual({ role: "status", liveRegion: "polite", label: "Custom" });
	});

	it("applies print:hidden when printHidden (feature 19)", () => {
		render(<Alert variant="info" title="NoPrint" printHidden />);
		expect(screen.getByText("NoPrint").closest("[data-slot='alert']")?.className).toContain("print:hidden");
	});
});
