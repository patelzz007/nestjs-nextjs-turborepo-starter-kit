import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { PasswordStrengthMeter, passwordStrengthBarVariants, strengthToneOf } from "../password-strength-meter";

describe("PasswordStrengthMeter", () => {
	it("is a progress bar named by its title and the caller's label", async () => {
		await render(<PasswordStrengthMeter score={3} label="Good" percent={75} />);

		const bar = screen.getByRole("progressbar", { name: "Password strength: Good" });
		expect(bar).toHaveAccessibilityValue({ min: 0, max: 100, now: 75, text: "Good" });
		expect(screen.getByText("Good")).toBeOnTheScreen();
	});

	it("renders nothing until there is a password", async () => {
		await render(<PasswordStrengthMeter score={0} label="Too weak" percent={0} testID="meter" />);
		expect(screen.queryByTestId("meter")).toBeNull();
	});

	it("keeps the bar on its 0–100 scale", async () => {
		await render(<PasswordStrengthMeter score={4} label="Strong" percent={140} />);
		expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ now: 100 });
	});

	it("colours each score tier with a status token", () => {
		expect([0, 1, 2, 3, 4].map(strengthToneOf)).toStrictEqual(["weak", "weak", "fair", "good", "strong"]);
		expect(passwordStrengthBarVariants({ tone: "weak" })).toContain("bg-destructive");
		expect(passwordStrengthBarVariants({ tone: "fair" })).toContain("bg-warning");
		expect(passwordStrengthBarVariants({ tone: "good" })).toContain("bg-info");
		expect(passwordStrengthBarVariants({ tone: "strong" })).toContain("bg-success");
	});

	it("lists the criteria with whether each is met", async () => {
		await render(
			<PasswordStrengthMeter
				score={2}
				label="Fair"
				percent={50}
				criteria={[
					{ label: "At least 8 characters", met: true },
					{ label: "A number", met: false },
				]}
			/>,
		);

		expect(screen.getByLabelText("At least 8 characters: Met")).toBeOnTheScreen();
		expect(screen.getByLabelText("A number: Not met")).toBeOnTheScreen();
	});

	it("falls back to the unmet list, with the caller's copy", async () => {
		await render(<PasswordStrengthMeter score={1} label="Weak" percent={25} missing={["A symbol"]} unmetLabel="Missing" title="Strength" />);

		expect(screen.getByLabelText("A symbol: Missing")).toBeOnTheScreen();
		expect(screen.getByRole("progressbar", { name: "Strength: Weak" })).toBeOnTheScreen();
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<PasswordStrengthMeter ref={ref} score={4} label="Strong" percent={100} size="sm" className="mt-2 gap-3" testID="meter" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("meter").props.className);
		expect(className).toContain("mt-2");
		expect(className).toContain("gap-3");
		expect(className).not.toContain("gap-1.5");
	});
});
