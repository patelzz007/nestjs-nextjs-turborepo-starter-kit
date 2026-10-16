// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../../../lib/labels/en";
import { CASCADER_NO_HIGHLIGHT, createCascaderHighlightStore, useCascaderActions, useCascaderHighlight, useCascaderState } from "../cascader-context";
import { resolveCascaderSearchLabel } from "../cascader-i18n";

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
});

describe("createCascaderHighlightStore", (): void => {
	it("keeps one snapshot until the highlight changes, and notifies only then", (): void => {
		const store = createCascaderHighlightStore();
		const listener = vi.fn();
		const unsubscribe = store.subscribe(listener);
		expect(store.getSnapshot()).toBe(CASCADER_NO_HIGHLIGHT);
		store.set({ index: 2, value: "pear" });
		store.set({ index: 2, value: "pear" });
		expect(listener).toHaveBeenCalledTimes(1);
		expect(store.getSnapshot()).toEqual({ index: 2, value: "pear" });
		unsubscribe();
		store.set({ index: 3, value: "kale" });
		expect(listener).toHaveBeenCalledTimes(1);
	});
});

function ActionsOutside(): React.JSX.Element {
	useCascaderActions();
	return <span />;
}

function StateOutside(): React.JSX.Element {
	useCascaderState();
	return <span />;
}

function HighlightOutside(): React.JSX.Element {
	const { index } = useCascaderHighlight();
	return <span data-testid="highlight">{index}</span>;
}

describe("context hooks", (): void => {
	it("fail loudly outside a Cascader, except the highlight, which degrades", (): void => {
		vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect((): void => {
			render(<ActionsOutside />);
		}).toThrow("useCascaderActions must be used within a Cascader");
		expect((): void => {
			render(<StateOutside />);
		}).toThrow("useCascaderState must be used within a Cascader");
		render(<HighlightOutside />);
		expect(screen.getByTestId("highlight").textContent).toBe("-1");
	});
});

describe("cascader labels", (): void => {
	it("ships the cascader family in the English pack and resolves the search placeholder", (): void => {
		const labels = UI_KIT_LABELS_EN.cascader;
		expect(resolveCascaderSearchLabel(labels)).toBe("Search…");
		expect(resolveCascaderSearchLabel(labels, "Fruit")).toBe("Search Fruit…");
		expect(resolveCascaderSearchLabel({ ...labels, search: "Find" }, "Fruit")).toBe("Find");
		expect(labels.levelAnnouncement("Fruit", 2, 1)).toBe("Fruit, level 2, 1 item");
		expect(labels.keyboardHint("tree", "rtl")).toBe("Use the Left Arrow key to expand and the Right Arrow key to collapse.");
	});
});
