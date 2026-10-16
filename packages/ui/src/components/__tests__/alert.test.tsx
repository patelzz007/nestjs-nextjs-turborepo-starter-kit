// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Alert, AlertAction, AlertDescription, AlertTitle, type AlertVariant } from "./alert";

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

	it.each(["destructive", "info", "success", "warning"] satisfies AlertVariant[])("tints the %s variant with its status token", (variant): void => {
		render(<Alert variant={variant}>Body</Alert>);
		const alert = screen.getByRole("alert");
		expect(alert.className).toContain(`border-${variant}/30`);
		expect(alert.dataset.variant).toBe(variant);
	});

	it("renders the invert variant on the inverted theme colours", (): void => {
		render(<Alert variant="invert">Body</Alert>);
		expect(screen.getByRole("alert").className).toContain("bg-invert");
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
});
