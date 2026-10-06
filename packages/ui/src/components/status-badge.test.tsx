import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { STATUS_TONE_BADGE_VARIANT, StatusBadge, type StatusTone } from "./status-badge";

afterEach((): void => {
	cleanup();
});

describe("StatusBadge", () => {
	it("maps every status tone onto one badge style", (): void => {
		const tones: readonly StatusTone[] = ["success", "warning", "danger", "info", "neutral", "muted"];
		for (const tone of tones) {
			cleanup();
			render(<StatusBadge tone={tone}>Label</StatusBadge>);
			expect(screen.getByText("Label").dataset.tone).toBe(tone);
		}
		expect(new Set(Object.values(STATUS_TONE_BADGE_VARIANT)).size).toBe(tones.length);
	});

	it("draws a waiting state as a warning and a failure as danger", (): void => {
		render(
			<>
				<StatusBadge tone="warning">Pending review</StatusBadge>
				<StatusBadge tone="danger">Rejected</StatusBadge>
			</>,
		);

		expect(screen.getByText("Pending review").className).toContain("text-warning-foreground");
		expect(screen.getByText("Rejected").className).toContain("text-destructive-foreground");
	});
});
