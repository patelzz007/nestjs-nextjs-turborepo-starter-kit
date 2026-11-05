// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { UI_KIT_LABELS_EN } from "../../lib/labels/en";
import { UI_KIT_LANGUAGE_PACKS } from "../../lib/labels/all-language-packs";
import { UI_KIT_LANGUAGES, UiKitLanguageSchema, loadUiKitLanguagePack } from "../../lib/labels/language-packs";
import type { UiKitLabels } from "../../lib/labels/ui-kit-labels";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { UiKitLabelsProvider, UiKitLanguageProvider, useUiKitLabels } from "../ui-kit-labels-provider";

afterEach((): void => {
	cleanup();
});

const CUSTOM_LABELS: UiKitLabels = { ...UI_KIT_LABELS_EN, dialog: { close: "Schließen" } };

function DialogCloseLabel({ override }: { readonly override?: { readonly close?: string } }): React.JSX.Element {
	const labels = useUiKitLabels("dialog", override);
	return <span>{labels.close}</span>;
}

const FRENCH_CLOSE_OVERRIDE = { close: "Fermer" };

describe("useUiKitLabels", () => {
	it("reads a family from the nearest language pack", (): void => {
		render(
			<UiKitLanguageProvider language="en">
				<DialogCloseLabel />
			</UiKitLanguageProvider>,
		);
		expect(screen.getByText(UI_KIT_LABELS_EN.dialog.close)).toBeTruthy();
	});

	it("reads a custom label set", (): void => {
		render(
			<UiKitLabelsProvider labels={CUSTOM_LABELS}>
				<DialogCloseLabel />
			</UiKitLabelsProvider>,
		);
		expect(screen.getByText("Schließen")).toBeTruthy();
	});

	it("lays a component's own override over the provider's strings", (): void => {
		render(<DialogCloseLabel override={FRENCH_CLOSE_OVERRIDE} />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("Fermer")).toBeTruthy();
	});

	it("returns the same object across renders while nothing changed", (): void => {
		const { result, rerender } = renderHook(() => useUiKitLabels("combobox"), { wrapper: UiKitTestProviders });
		const first = result.current;
		rerender();
		expect(result.current).toBe(first);
	});

	it("fails loudly without a provider instead of rendering blank controls", (): void => {
		expect(() => render(<DialogCloseLabel />)).toThrow('No UiKitLabelsProvider above a component that needs "dialog" labels');
	});
});

describe("loading a language pack", () => {
	it("shows another language once its pack has loaded, and English without waiting", async (): Promise<void> => {
		// A suspended `use()` resumes inside an async act (React 19): this waits for the pack's import.
		await act(async (): Promise<void> => {
			render(
				<React.Suspense fallback={<span>loading</span>}>
					<UiKitLanguageProvider language="ms">
						<DialogCloseLabel />
					</UiKitLanguageProvider>
				</React.Suspense>,
			);
			await loadUiKitLanguagePack("ms");
		});
		expect(screen.getByText(UI_KIT_LANGUAGE_PACKS.ms.dialog.close)).toBeTruthy();
		cleanup();

		render(
			<React.Suspense fallback={<span>loading</span>}>
				<UiKitLanguageProvider language="en">
					<DialogCloseLabel />
				</UiKitLanguageProvider>
			</React.Suspense>,
		);
		expect(screen.queryByText("loading")).toBeNull();
		expect(screen.getByText(UI_KIT_LABELS_EN.dialog.close)).toBeTruthy();
	});

	it("loads each pack once, and loads the right one", async (): Promise<void> => {
		for (const language of UI_KIT_LANGUAGES) {
			expect(loadUiKitLanguagePack(language)).toBe(loadUiKitLanguagePack(language));
			const loaded = await loadUiKitLanguagePack(language);
			const expected = UI_KIT_LANGUAGE_PACKS[language];
			// The loader binds its own copy of the language's catalogue: the same words and the same formatting.
			expect(loaded.dialog.close).toBe(expected.dialog.close);
			expect(loaded.dateSelector.months).toStrictEqual(expected.dateSelector.months);
			expect(loaded.cascader.itemCount(3)).toBe(expected.cascader.itemCount(3));
		}
	});
});

describe("language packs", () => {
	it("registers a complete pack for every shipped language", (): void => {
		for (const language of UI_KIT_LANGUAGES) {
			expect(UiKitLanguageSchema.parse(language)).toBe(language);
			expect(Object.keys(UI_KIT_LANGUAGE_PACKS[language]).sort()).toEqual(Object.keys(UI_KIT_LABELS_EN).sort());
		}
	});
});
