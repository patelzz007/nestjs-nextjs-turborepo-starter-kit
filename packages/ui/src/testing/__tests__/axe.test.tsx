// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { accessibilityViolations } from "../axe";

afterEach((): void => {
	cleanup();
});

describe("accessibilityViolations", () => {
	it("reports a nameless button and an unlabelled input, with the elements at fault", async () => {
		render(
			<form>
				<button type="button">
					<svg aria-hidden="true" />
				</button>
				<input type="text" />
			</form>,
		);
		const violations = await accessibilityViolations(document.body);

		expect(violations.map((violation) => violation.rule).sort()).toStrictEqual(["button-name", "label"]);
		expect(violations.flatMap((violation) => violation.targets).sort()).toStrictEqual(["button", "input"]);
		expect(violations.every((violation) => violation.impact === "critical" || violation.impact === "serious")).toBe(true);
	});

	it("passes accessible markup, and ignores what jsdom can't judge (contrast, landmarks)", async () => {
		render(
			<div style={{ color: "#777", background: "#888" }}>
				<button type="button">Save</button>
			</div>,
		);
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});
});
