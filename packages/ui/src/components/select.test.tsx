// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Select, SelectChip, SelectChips, SelectClear, SelectClearAll, SelectContent, SelectEmpty, SelectItem, SelectTrigger, SelectValue, type SelectLabels } from "./select";
import { describeSelection } from "./select-context";
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

const FRENCH_LABELS: SelectLabels = {
	clearSelection: "Effacer",
	clearAll: "Tout effacer",
	moreSelected: "Autres options",
	removeOption: (value: string): string => `Retirer ${value}`,
	loading: "Chargement…",
	empty: "Aucune option",
	nothingSelected: "Rien de sélectionné",
	selectedOne: (label: string): string => `${label} sélectionné`,
	selectedMany: (count: number, labels: string): string => `${count.toString()} sélectionnés : ${labels}`,
};

/** Stable no-op handler (rule 16: no inline arrows in props). */
function noop(): void {
	return;
}

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("Select labels", () => {
	it("routes every part's copy through the Root's labels", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Select labels={FRENCH_LABELS} loading open>
				<SelectTrigger>
					<SelectChips maxChips={1}>
						<SelectChip value="a" label="A" onRemove={noop} />
						<SelectChip value="b" label="B" onRemove={noop} />
					</SelectChips>
					<SelectClear onClear={noop} />
				</SelectTrigger>
				<SelectContent>
					<SelectEmpty />
				</SelectContent>
			</Select>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("button", { name: "Effacer" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Retirer a" })).toBeTruthy();
		expect(screen.getByLabelText("Autres options").textContent).toBe("+1");
		expect(screen.getByText("Chargement…")).toBeTruthy();
		expect(screen.getByText("Aucune option")).toBeTruthy();
	});

	it("lets a part-level prop override the Root's labels", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<Select labels={FRENCH_LABELS}>
				<SelectTrigger>
					<SelectValue />
					<SelectClear ariaLabel="Reset language" onClear={noop} />
				</SelectTrigger>
			</Select>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("button", { name: "Reset language" })).toBeTruthy();
	});

	it("reads the provider's select copy outside a Select (clear-all lives beside the trigger)", (): void => {
		render(<SelectClearAll onClearAll={noop} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("button", { name: UI_KIT_LABELS_EN.select.clearAll })).toBeTruthy();
	});

	it("describes selections for the live region with the supplied labels", (): void => {
		expect(describeSelection(null, undefined, FRENCH_LABELS)).toBe("Rien de sélectionné");
		expect(describeSelection("fr", undefined, FRENCH_LABELS)).toBe("fr sélectionné");
		expect(describeSelection(["a", "b"], undefined, FRENCH_LABELS)).toBe("2 sélectionnés : a, b");
	});
});

describe("Select refs", () => {
	it("forwards refs on SelectValue, SelectClear and SelectEmpty", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const valueRef = React.createRef<HTMLSpanElement>();
		const clearRef = React.createRef<HTMLSpanElement>();
		const emptyRef = React.createRef<HTMLDivElement>();
		render(
			<Select open>
				<SelectTrigger>
					<SelectValue ref={valueRef} placeholder="Pick" />
					<SelectClear ref={clearRef} onClear={noop} />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="a">A</SelectItem>
					<SelectEmpty ref={emptyRef} />
				</SelectContent>
			</Select>,
			{ wrapper: UiKitTestProviders },
		);
		expect(valueRef.current?.dataset.slot).toBe("select-value");
		expect(clearRef.current?.dataset.slot).toBe("select-clear");
		expect(emptyRef.current?.dataset.slot).toBe("select-empty");
	});
});
