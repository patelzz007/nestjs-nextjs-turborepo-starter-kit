import { renderHook, render, screen } from "@testing-library/react-native";
import * as React from "react";

import * as mockUniwindDefaults from "../../../../test/uniwind-mock";
import { IllustrationFade, useIllustrationColors } from "../examples/empty/illustration";

/** The colours the stylesheet resolves, per CSS variable; empty until it has. */
const mockColors: { current: Readonly<Record<string, string>> } = { current: {} };

jest.mock("uniwind", () => ({
	...mockUniwindDefaults,
	useCSSVariable: (name: string): string | undefined => mockColors.current[name],
}));

const RESOLVED: Readonly<Record<string, string>> = {
	"--color-primary": "#1e293b",
	"--color-muted": "#f1f5f9",
	"--color-muted-foreground": "#606f85",
	"--color-border": "#e2e8f0",
	"--color-background": "#ffffff",
	"--color-destructive": "#e5484d",
};

describe("the empty-state drawings' colours", () => {
	it("are the theme's, once the stylesheet resolves them", async () => {
		mockColors.current = RESOLVED;
		const { result } = await renderHook(useIllustrationColors);
		expect(result.current).toEqual({
			primary: "#1e293b",
			muted: "#f1f5f9",
			mutedForeground: "#606f85",
			border: "#e2e8f0",
			background: "#ffffff",
			destructive: "#e5484d",
		});
	});

	it("are nothing while any one is unresolved, so nothing is drawn in a wrong colour", async () => {
		mockColors.current = Object.fromEntries(Object.entries(RESOLVED).filter(([name]: readonly [string, string]): boolean => name !== "--color-border"));
		const { result } = await renderHook(useIllustrationColors);
		expect(result.current).toBeNull();
	});

	it("fade into the background, or draw no fade before the background resolves", async () => {
		mockColors.current = RESOLVED;
		await render(<IllustrationFade className="h-8" />);
		expect(screen.toJSON()).not.toBeNull();
		mockColors.current = {};
		const { toJSON } = await render(<IllustrationFade className="h-8" />);
		expect(JSON.stringify(toJSON())).not.toContain("illustration-fade");
	});
});
