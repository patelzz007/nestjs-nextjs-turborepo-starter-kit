import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { Text } from "react-native";

import { BodyText, CodeText, ErrorText, Heading, Label, MutedText, Subheading, textVariants, type TextVariant } from "../text";

const TEXT_VARIANTS: readonly TextVariant[] = ["heading", "subheading", "body", "muted", "label", "error", "code"];

const BACKUP_CODE = "ABCD-1234";

describe("Text roles", () => {
	it("announces headings as headers, overridable by the caller", async () => {
		await render(
			<>
				<Heading>Profile</Heading>
				<Subheading>Security</Subheading>
				<Heading accessibilityRole="text">Plain title</Heading>
			</>,
		);

		expect(screen.getByRole("header", { name: "Profile" })).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Security" })).toBeOnTheScreen();
		expect(screen.queryByRole("header", { name: "Plain title" })).toBeNull();
	});

	it("gives each role its typeface family and colour token", async () => {
		await render(
			<>
				<BodyText>Body</BodyText>
				<MutedText>Muted</MutedText>
				<Label>Email</Label>
				<ErrorText>Required</ErrorText>
				<CodeText>{BACKUP_CODE}</CodeText>
			</>,
		);

		expect(screen.getByText("Body")).toHaveProp("className", expect.stringContaining("font-sans text-base text-foreground"));
		expect(screen.getByText("Muted")).toHaveProp("className", expect.stringContaining("text-muted-foreground"));
		expect(screen.getByText("Email")).toHaveProp("className", expect.stringContaining("font-sans-medium"));
		expect(screen.getByText("Required")).toHaveProp("className", expect.stringContaining("text-destructive-foreground"));
		expect(screen.getByText("ABCD-1234")).toHaveProp("className", expect.stringContaining("font-mono"));
	});

	it("never uses a weight utility, only font families (rules/04)", () => {
		for (const variant of TEXT_VARIANTS) {
			expect(textVariants({ variant })).not.toMatch(/\bfont-(medium|semibold|bold)\b/u);
		}
	});

	it("merges the caller's className last, so its tokens win", async () => {
		await render(<MutedText className="text-xs text-foreground">Caption</MutedText>);

		const className = String(screen.getByText("Caption").props.className);
		expect(className).toContain("text-xs");
		expect(className).toContain("text-foreground");
		expect(className).not.toContain("text-muted-foreground");
		expect(className).not.toContain("text-sm");
	});

	it("passes Text props through and forwards its ref", async () => {
		const ref = React.createRef<Text>();
		await render(
			<BodyText ref={ref} numberOfLines={2} testID="body">
				Long text
			</BodyText>,
		);

		expect(screen.getByTestId("body")).toHaveProp("numberOfLines", 2);
		expect(ref.current).not.toBeNull();
	});
});
