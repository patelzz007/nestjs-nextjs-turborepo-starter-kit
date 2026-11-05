// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Alert, AlertAction, AlertDescription, AlertTitle, type AlertVariant } from "../alert";

afterEach((): void => {
	cleanup();
});

describe("Alert", () => {
	it("composes title, description and action under one alert region", (): void => {
		render(
			<Alert>
				<AlertTitle>Heads up</AlertTitle>
				<AlertDescription>Maintenance at 02:00 UTC</AlertDescription>
				<AlertAction>
					<button type="button">Dismiss</button>
				</AlertAction>
			</Alert>,
		);
		const alert = screen.getByRole("alert");
		expect(alert.textContent).toContain("Heads up");
		expect(alert.textContent).toContain("Maintenance at 02:00 UTC");
		expect(screen.getByRole("button", { name: "Dismiss" }).closest('[data-slot="alert-action"]')).toBeTruthy();
	});

	it("lets the caller choose a polite status role instead of an interrupting alert", (): void => {
		render(<Alert role="status">Saved</Alert>);
		expect(screen.getByRole("status").textContent).toBe("Saved");
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it.each(["default", "destructive", "info", "success", "warning", "invert"] satisfies AlertVariant[])(
		"marks the %s variant on data-variant and keeps the default role",
		(variant): void => {
			render(<Alert variant={variant}>Body</Alert>);
			expect(screen.getByRole("alert").dataset.variant).toBe(variant);
		},
	);

	it("reports the default variant when none is given", (): void => {
		render(<Alert>Body</Alert>);
		expect(screen.getByRole("alert").dataset.variant).toBe("default");
	});

	it.each([
		["default", "lucide-info"],
		["destructive", "lucide-octagon-alert"],
		["info", "lucide-info"],
		["success", "lucide-circle-check"],
		["warning", "lucide-triangle-alert"],
		["invert", "lucide-info"],
	] satisfies [AlertVariant, string][])("shows the %s variant's default icon, hidden from assistive tech", (variant, iconClass): void => {
		render(
			<Alert variant={variant}>
				<AlertTitle>Heads up</AlertTitle>
			</Alert>,
		);
		const icons = screen.getByRole("alert").querySelectorAll("svg");
		expect(Array.from(icons, (icon) => icon.getAttribute("aria-hidden"))).toEqual(["true"]);
		expect(Array.from(icons, (icon) => icon.classList.contains(iconClass))).toEqual([true]);
	});

	it("uses the caller's own icon instead of the default one", (): void => {
		render(
			<Alert variant="warning">
				<svg data-testid="custom-icon" aria-hidden="true" />
				<AlertTitle>Heads up</AlertTitle>
			</Alert>,
		);
		expect(Array.from(screen.getByRole("alert").querySelectorAll("svg"), (icon) => icon.dataset.testid)).toEqual(["custom-icon"]);
	});

	it("drops the default icon when the caller leads with other media, such as an avatar", (): void => {
		render(
			<Alert>
				<span data-testid="avatar">AJ</span>
				<AlertTitle>Alex Johnson</AlertTitle>
			</Alert>,
		);
		expect(screen.getByRole("alert").querySelector("svg")).toBeNull();
		expect(screen.getByTestId("avatar").textContent).toBe("AJ");
	});

	it("keeps the default icon for conditionally rendered parts and plain text", (): void => {
		render(
			<Alert>
				{null}
				{false}
				Saved
			</Alert>,
		);
		expect(screen.getByRole("alert").querySelector('[data-slot="alert-icon"]')).toBeTruthy();
	});

	it("mutes the description under a title", (): void => {
		render(
			<Alert>
				<AlertTitle>Heads up</AlertTitle>
				<AlertDescription>Detail</AlertDescription>
			</Alert>,
		);
		expect(screen.getByText("Detail").className).toContain("text-muted-foreground");
		expect(screen.getByText("Heads up").className).toContain("text-foreground");
	});

	it("gives a title-less description the foreground colour, because it is the message", (): void => {
		render(
			<Alert variant="info">
				<AlertDescription>Token connected</AlertDescription>
			</Alert>,
		);
		const description = screen.getByText("Token connected");
		expect(description.classList.contains("text-foreground")).toBe(true);
		expect(description.classList.contains("text-muted-foreground")).toBe(false);
	});

	it("keeps title and description legible on the invert surface", (): void => {
		const { rerender } = render(
			<Alert variant="invert">
				<AlertTitle>Invert</AlertTitle>
				<AlertDescription>Detail</AlertDescription>
			</Alert>,
		);
		expect(screen.getByRole("alert").className).toContain("bg-invert");
		expect(screen.getByText("Invert").classList.contains("text-invert-foreground")).toBe(true);
		expect(screen.getByText("Detail").classList.contains("text-invert-foreground/70")).toBe(true);
		rerender(
			<Alert variant="invert">
				<AlertDescription>Detail</AlertDescription>
			</Alert>,
		);
		expect(screen.getByText("Detail").classList.contains("text-invert-foreground")).toBe(true);
	});

	it("lets the caller's className override a part's colour", (): void => {
		render(
			<Alert>
				<AlertDescription className="text-success">Detail</AlertDescription>
			</Alert>,
		);
		const description = screen.getByText("Detail");
		expect(description.classList.contains("text-success")).toBe(true);
		expect(description.classList.contains("text-foreground")).toBe(false);
	});

	it("renders parts outside an Alert as a titled, default-surface description", (): void => {
		render(<AlertDescription>Loose</AlertDescription>);
		expect(screen.getByText("Loose").classList.contains("text-muted-foreground")).toBe(true);
	});

	it("tints only the icon tile, never the card, for status variants", (): void => {
		render(<Alert variant="destructive">Body</Alert>);
		const alert = screen.getByRole("alert");
		expect(alert.classList.contains("bg-card")).toBe(true);
		expect(alert.classList.contains("border-border")).toBe(true);
		expect(alert.className).toContain("[--alert-tone:var(--destructive)]");
		expect(alert.className).toContain("color-mix(in_oklab");
	});

	it("tightens padding and type for the sm size", (): void => {
		render(<Alert size="sm">Body</Alert>);
		expect(screen.getByRole("alert").className).toContain("text-xs");
	});

	it("forwards refs on every part", (): void => {
		const rootRef = React.createRef<HTMLDivElement>();
		const titleRef = React.createRef<HTMLDivElement>();
		const descriptionRef = React.createRef<HTMLDivElement>();
		const actionRef = React.createRef<HTMLDivElement>();
		render(
			<Alert ref={rootRef}>
				<AlertTitle ref={titleRef}>T</AlertTitle>
				<AlertDescription ref={descriptionRef}>D</AlertDescription>
				<AlertAction ref={actionRef}>A</AlertAction>
			</Alert>,
		);
		expect([rootRef, titleRef, descriptionRef, actionRef].map((ref) => ref.current?.dataset.slot)).toEqual(["alert", "alert-title", "alert-description", "alert-action"]);
	});

	it("should let the title and description shrink to their column, so wide content stays inside the card", () => {
		// jsdom has no layout: this pins the class that keeps a code block or long URL from widening the card.
		render(
			<Alert variant="info">
				<AlertTitle>Note</AlertTitle>
				<AlertDescription>
					<pre>GET /api/v1/product?page=2&amp;limit=25&amp;sort=-price,name&amp;filter[isActive]=true</pre>
				</AlertDescription>
			</Alert>,
		);
		expect(screen.getByText("Note").className).toContain("min-w-0");
		const description = screen.getByText(/GET \/api\/v1\/product/).parentElement?.className ?? "";
		expect(description).toContain("min-w-0");
		expect(description).toContain("grid-cols-[minmax(0,1fr)]");
	});
});
