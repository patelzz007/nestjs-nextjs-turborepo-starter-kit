// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi, beforeAll } from "vitest";

import type { UiKitLanguage } from "../../lib/labels/language-packs";
import { UI_KIT_LABELS_EN } from "../../lib/labels/en";
import { ShellLanguageToggle } from "../shell-language-toggle";
import { UiKitLabelsProvider, UiKitLanguageProvider, useUiKitLanguage } from "../ui-kit-labels-provider";
import { UI_KIT_LANGUAGES, loadUiKitLanguagePack } from "../../lib/labels/language-packs";

afterEach((): void => {
	cleanup();
});

function Shell({ language, onLanguageChange }: { readonly language: UiKitLanguage; readonly onLanguageChange?: (language: UiKitLanguage) => void }): React.JSX.Element {
	return (
		<UiKitLanguageProvider language={language} onLanguageChange={onLanguageChange}>
			<ShellLanguageToggle />
		</UiKitLanguageProvider>
	);
}

// Non-English packs load on demand (ADR 076); load them once so each render here is synchronous.
beforeAll(async (): Promise<void> => {
	await Promise.all(UI_KIT_LANGUAGES.map(loadUiKitLanguagePack));
});

describe("ShellLanguageToggle", () => {
	it("lists every language in its own name, the one on screen checked, and reports a choice", async () => {
		const onLanguageChange = vi.fn<(language: UiKitLanguage) => void>();
		render(<Shell language="ms" onLanguageChange={onLanguageChange} />);

		fireEvent.click(screen.getByRole("button", { name: "Pilih bahasa" }));
		const options = await screen.findAllByRole("menuitemradio");
		expect(options.map((option) => option.textContent)).toStrictEqual(["English", "Bahasa Melayu", "简体中文", "தமிழ்"]);
		expect(screen.getByRole("menuitemradio", { name: "Bahasa Melayu" }).getAttribute("aria-checked")).toBe("true");
		expect(screen.getByRole("menuitemradio", { name: "தமிழ்" }).getAttribute("lang")).toBe("ta");

		fireEvent.click(screen.getByRole("menuitemradio", { name: "简体中文" }));
		expect(onLanguageChange).toHaveBeenCalledWith("zh-Hans");
	});

	it("renders nothing when the app gives no way to change language, or outside a language provider", () => {
		const { container, rerender } = render(<Shell language="en" />);
		expect(container.innerHTML).toBe("");
		rerender(
			<UiKitLabelsProvider labels={UI_KIT_LABELS_EN}>
				<ShellLanguageToggle />
			</UiKitLabelsProvider>,
		);
		expect(container.innerHTML).toBe("");
	});
});

describe("useUiKitLanguage", () => {
	function Probe(): React.JSX.Element {
		const state = useUiKitLanguage();
		return <span>{state === null ? "none" : `${state.language}:${state.chooseLanguage === null ? "fixed" : "changeable"}`}</span>;
	}

	it("tells the language on screen and whether it can change", () => {
		const { rerender } = render(
			<UiKitLanguageProvider language="ta">
				<Probe />
			</UiKitLanguageProvider>,
		);
		expect(screen.getByText("ta:fixed")).toBeTruthy();
		rerender(
			<UiKitLanguageProvider language="zh-Hans" onLanguageChange={vi.fn()}>
				<Probe />
			</UiKitLanguageProvider>,
		);
		expect(screen.getByText("zh-Hans:changeable")).toBeTruthy();
	});
});
