import { render, screen } from "@testing-library/react-native";
import * as React from "react";

import { LanguageBreakdown, type LanguageShare } from "./language-breakdown";
import { LanguageLogo } from "./language-logo";

const TYPESCRIPT: LanguageShare = {
	name: "TypeScript",
	percent: 82.4,
	percentLabel: "82.4%",
	color: "#3178c6",
	tint: "#3178c629",
	logoPath: "M0 0h24v24H0z",
	monogram: "Ty",
};
const CSHARP: LanguageShare = { name: "C#", percent: 17.6, percentLabel: "17.6%", color: null, tint: null, logoPath: null, monogram: "C#" };
const UNUSED: LanguageShare = { name: "Shell", percent: 0, percentLabel: "0%", color: "#89e051", tint: "#89e05129", logoPath: null, monogram: "Sh" };

describe("LanguageBreakdown", () => {
	it("reads the bar as one sentence and each language as `name: share`", async () => {
		await render(<LanguageBreakdown title="Languages" languages={[TYPESCRIPT, CSHARP]} />);

		expect(screen.getByLabelText("Languages: TypeScript 82.4%, C# 17.6%")).toBeOnTheScreen();
		expect(screen.getByLabelText("TypeScript: 82.4%")).toBeOnTheScreen();
		expect(screen.getByLabelText("C#: 17.6%")).toBeOnTheScreen();
	});

	it("gives each language a part of the bar as wide as its share, in its colour, and none to a share of zero", async () => {
		await render(<LanguageBreakdown title="Languages" languages={[TYPESCRIPT, CSHARP, UNUSED]} />);

		expect(screen.getByTestId("language-bar-TypeScript", { includeHiddenElements: true })).toHaveStyle({ flexGrow: 82.4, backgroundColor: "#3178c6" });
		expect(screen.getByTestId("language-bar-C#", { includeHiddenElements: true })).toHaveStyle({ flexGrow: 17.6 });
		expect(screen.queryByTestId("language-bar-Shell", { includeHiddenElements: true })).toBeNull();
		expect(screen.getByLabelText("Shell: 0%")).toBeOnTheScreen();
	});
});

describe("LanguageLogo", () => {
	it("draws the logo on the language's tint, hidden from screen readers", async () => {
		await render(<LanguageLogo path={TYPESCRIPT.logoPath} monogram="Ty" tint="#3178c629" testID="logo" />);

		expect(screen.queryByTestId("logo")).toBeNull();
		const tile = screen.getByTestId("logo", { includeHiddenElements: true });
		expect(tile).toHaveStyle({ backgroundColor: "#3178c629" });
		expect(screen.queryByText("Ty", { includeHiddenElements: true })).toBeNull();
	});

	it("shows the monogram for a language without a logo", async () => {
		await render(<LanguageLogo path={null} monogram="C#" tint={null} />);

		expect(screen.getByText("C#", { includeHiddenElements: true })).toBeOnTheScreen();
	});
});
