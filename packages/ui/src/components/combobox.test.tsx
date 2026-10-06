// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxClearAll,
	ComboboxContent,
	ComboboxCreate,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxList,
	ComboboxLoading,
	countSelection,
	type ComboboxLabels,
} from "./combobox";
import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";

/** jsdom has no ResizeObserver; base-ui tolerates its absence, stub to be safe. */
class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

const FRENCH_LABELS: ComboboxLabels = {
	openOptions: "Ouvrir",
	clearSelection: "Effacer",
	clearAll: "Tout effacer",
	loading: "Chargement…",
	empty: "Aucun résultat",
	moreSelected: "Autres options",
	removeOption: (label: string): string => `Retirer ${label}`,
	removeOptionFallback: "Retirer l'option",
	selectedCount: (count: number): string => `${count.toString()} sélectionnés`,
};

/** Stable handlers (rule 16: no inline arrows in props). */
function noop(): void {
	return;
}
function createLabel(query: string): string {
	return `Créer « ${query} »`;
}

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("Combobox labels", () => {
	it("routes the trigger, loading and live-region copy through the Root's labels", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(
			<Combobox labels={FRENCH_LABELS} loading open>
				<ComboboxInput showClear />
				<ComboboxContent>
					<ComboboxList />
				</ComboboxContent>
			</Combobox>,
			{ wrapper: UiKitTestProviders },
		);
		// The open popup marks the outside tree aria-hidden, so include hidden nodes.
		expect(screen.getByRole("button", { name: "Ouvrir", hidden: true })).toBeTruthy();
		expect(screen.getByText("Chargement…")).toBeTruthy();
		expect(container.querySelector('[data-slot="combobox-live-region"]')?.textContent).toBe("0 sélectionnés");
	});

	it("shows the Root's empty copy when ComboboxEmpty has no text", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Combobox labels={FRENCH_LABELS} defaultOpen>
				<ComboboxInput placeholder="Search" />
				<ComboboxContent>
					<ComboboxList>
						<ComboboxEmpty />
					</ComboboxList>
				</ComboboxContent>
			</Combobox>,
			{ wrapper: UiKitTestProviders },
		);
		// Base UI keeps the node `hidden` until the list is `data-empty`, so assert on the slot.
		expect(document.querySelector("[data-slot='combobox-empty']")?.textContent).toContain("Aucun résultat");
	});

	it("labels the clear button from the Root's labels once a value is selected", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Combobox labels={FRENCH_LABELS} defaultValue="react">
				<ComboboxInput showClear />
			</Combobox>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("button", { name: "Effacer" })).toBeTruthy();
	});

	it("derives chip remove labels and the overflow label from the Root's labels", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Combobox labels={FRENCH_LABELS} multiple defaultValue={["react", "vue"]}>
				<ComboboxChips maxChips={1}>
					<ComboboxChip>React</ComboboxChip>
					<ComboboxChip>Vue</ComboboxChip>
				</ComboboxChips>
			</Combobox>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("button", { name: "Retirer React" })).toBeTruthy();
		expect(screen.getByLabelText("Autres options").textContent).toBe("+1");
	});

	it("reads the provider's combobox copy outside a Combobox", (): void => {
		render(<ComboboxClearAll onClick={noop} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("button", { name: UI_KIT_LABELS_EN.combobox.clearAll })).toBeTruthy();
	});
});

describe("Combobox refs", () => {
	it("forwards refs on ComboboxLoading, ComboboxCreate and ComboboxClearAll", (): void => {
		const loadingRef = React.createRef<HTMLDivElement>();
		const createRef = React.createRef<HTMLElement>();
		const clearAllRef = React.createRef<HTMLElement>();
		render(
			<>
				<ComboboxLoading ref={loadingRef} label="Loading" />
				<ComboboxCreate ref={createRef} query="Go" createLabel={createLabel} onCreate={noop} />
				<ComboboxClearAll ref={clearAllRef} ariaLabel="Reset" />
			</>,
			{ wrapper: UiKitTestProviders },
		);
		expect(loadingRef.current?.dataset.slot).toBe("combobox-loading");
		expect(createRef.current?.dataset.slot).toBe("combobox-create");
		expect(clearAllRef.current?.dataset.slot).toBe("combobox-clear-all");
	});
});

function liveRegionText(container: HTMLElement): string | null | undefined {
	return container.querySelector('[data-slot="combobox-live-region"]')?.textContent;
}

describe("countSelection", () => {
	it("counts an array's items, one single value, and nothing for null or undefined", (): void => {
		expect(countSelection(["a", "b", "c"])).toBe(3);
		expect(countSelection("a")).toBe(1);
		expect(countSelection(null)).toBe(0);
		expect(countSelection(undefined)).toBe(0);
	});
});

describe("Combobox selection-count live region", () => {
	it("starts at one for a single defaultValue", (): void => {
		const { container } = render(
			<Combobox labels={FRENCH_LABELS} defaultValue="js">
				<ComboboxInput />
			</Combobox>,
			{ wrapper: UiKitTestProviders },
		);
		expect(liveRegionText(container)).toBe("1 sélectionnés");
	});

	it("starts at the item count for a multiple defaultValue", (): void => {
		const { container } = render(
			<Combobox labels={FRENCH_LABELS} multiple defaultValue={["js", "ts"]}>
				<ComboboxInput />
			</Combobox>,
			{ wrapper: UiKitTestProviders },
		);
		expect(liveRegionText(container)).toBe("2 sélectionnés");
	});

	it("follows a controlled value the parent changes, including a reset to null", (): void => {
		const { container, rerender } = render(
			<Combobox labels={FRENCH_LABELS} value="js" onValueChange={noop}>
				<ComboboxInput />
			</Combobox>,
			{ wrapper: UiKitTestProviders },
		);
		expect(liveRegionText(container)).toBe("1 sélectionnés");

		rerender(
			<Combobox labels={FRENCH_LABELS} value={null} onValueChange={noop}>
				<ComboboxInput />
			</Combobox>,
		);
		expect(liveRegionText(container)).toBe("0 sélectionnés");
	});
});
