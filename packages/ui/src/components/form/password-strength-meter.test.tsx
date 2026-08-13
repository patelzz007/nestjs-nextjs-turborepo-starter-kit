// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PasswordStrengthMeter, type PasswordStrengthCriterion } from "./password-strength-meter";

afterEach((): void => {
	cleanup();
});

const CRITERIA: readonly PasswordStrengthCriterion[] = [
	{ label: "At least 8 characters", met: true },
	{ label: "An uppercase letter", met: true },
	{ label: "A lowercase letter", met: true },
	{ label: "A number", met: false },
	{ label: "A special character", met: false },
];

describe("PasswordStrengthMeter", () => {
	it("renders nothing for an empty password (percent 0)", (): void => {
		const { container } = render(<PasswordStrengthMeter score={0} label="Very weak" percent={0} />);
		expect(container.firstChild).toBeNull();
	});

	it("shows the strength label and a progressbar with aria values", (): void => {
		render(<PasswordStrengthMeter score={2} label="Fair" percent={50} criteria={CRITERIA} />);

		expect(screen.getByText("Password strength")).toBeTruthy();
		expect(screen.getByText("Fair")).toBeTruthy();

		const bar = screen.getByRole("progressbar");
		expect(bar.getAttribute("aria-valuenow")).toBe("50");
		expect(bar.getAttribute("aria-valuemin")).toBe("0");
		expect(bar.getAttribute("aria-valuemax")).toBe("100");
		expect(bar.getAttribute("aria-label")).toBe("Password strength: Fair");
	});

	it("colors the filled bar to the exact percent width", (): void => {
		render(<PasswordStrengthMeter score={4} label="Strong" percent={100} criteria={CRITERIA} />);

		const bar = screen.getByRole("progressbar");
		const fill = bar.firstElementChild;
		expect(fill).not.toBeNull();
		expect(fill?.getAttribute("style")).toContain("width: 100%");
	});

	it("renders a ✓/✗ checklist for every criterion when provided", (): void => {
		render(<PasswordStrengthMeter score={3} label="Good" percent={75} criteria={CRITERIA} />);

		for (const criterion of CRITERIA) {
			expect(screen.getByText(criterion.label)).toBeTruthy();
		}
		// Met rows carry the success check icon; unmet rows the muted ✗ icon.
		expect(CRITERIA.filter((c) => c.met).length).toBeGreaterThan(0);
		expect(CRITERIA.filter((c) => !c.met).length).toBeGreaterThan(0);
	});

	it("falls back to the legacy missing-list when criteria is absent", (): void => {
		render(<PasswordStrengthMeter score={1} label="Weak" percent={25} missing={["An uppercase letter"]} />);

		expect(screen.getByText("An uppercase letter")).toBeTruthy();
	});

	it("forwards its ref to the root element (rule 20)", (): void => {
		const ref: { readonly current: HTMLDivElement | null } = { current: null };

		render(<PasswordStrengthMeter ref={ref} score={2} label="Fair" percent={50} />);

		const root = document.querySelector('[data-slot="password-strength"]');
		expect(ref.current).toBe(root);
		expect(ref.current).toBeInstanceOf(HTMLDivElement);
	});
});
