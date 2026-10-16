// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Autocomplete, AutocompleteContent, AutocompleteEmpty, AutocompleteInput, AutocompleteItem, AutocompleteList } from "./autocomplete";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";

/** jsdom has no ResizeObserver; base-ui's popup and scroll area expect one. */
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

const FRUITS: readonly string[] = ["Apple", "Apricot", "Banana"];

function renderFruit(fruit: string): React.JSX.Element {
	return (
		<AutocompleteItem key={fruit} value={fruit}>
			{fruit}
		</AutocompleteItem>
	);
}

interface FixtureProps {
	readonly value?: string;
	readonly onValueChange?: (value: string) => void;
	readonly disabled?: boolean;
	readonly invalid?: boolean;
	readonly loading?: boolean;
	readonly inputRef?: React.Ref<HTMLInputElement>;
	readonly className?: string;
}

function Fixture({ value, onValueChange, disabled, invalid, loading, inputRef, className }: FixtureProps): React.JSX.Element {
	return (
		<Autocomplete items={FRUITS} value={value} onValueChange={onValueChange}>
			<AutocompleteInput ref={inputRef} aria-label="Fruit" showClear showTrigger disabled={disabled} aria-invalid={invalid} loading={loading} className={className} />
			<AutocompleteContent>
				<AutocompleteEmpty>No fruit</AutocompleteEmpty>
				<AutocompleteList>{renderFruit}</AutocompleteList>
			</AutocompleteContent>
		</Autocomplete>
	);
}

/** jsdom has no Web Animations API; base-ui's scroll area waits on `getAnimations()`. */
function noAnimations(): Animation[] {
	return [];
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	Object.defineProperty(HTMLElement.prototype, "getAnimations", { configurable: true, value: noAnimations });
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(HTMLElement.prototype, "getAnimations");
});

describe("Autocomplete", () => {
	it("renders a combobox input with named icon buttons", (): void => {
		render(<Fixture />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("combobox", { name: "Fruit" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Show suggestions" })).toBeTruthy();
	});

	it("filters suggestions as the user types and fills the input with a pick", async (): Promise<void> => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });
		const input = screen.getByRole("combobox", { name: "Fruit" });
		fireEvent.click(screen.getByRole("button", { name: "Show suggestions" }));
		fireEvent.change(input, { target: { value: "ap" } });
		expect(onValueChange).toHaveBeenLastCalledWith("ap", expect.anything());
		const options = await screen.findAllByRole("option", { hidden: true });
		expect(options.map((option) => option.textContent)).toEqual(["Apple", "Apricot"]);
		fireEvent.click(screen.getByRole("option", { name: "Apricot", hidden: true }));
		expect(onValueChange).toHaveBeenLastCalledWith("Apricot", expect.anything());
	});

	it("follows a controlled value", (): void => {
		const { rerender } = render(<Fixture value="Banana" />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("combobox")).toHaveProperty("value", "Banana");
		rerender(<Fixture value="Apple" />);
		expect(screen.getByRole("combobox")).toHaveProperty("value", "Apple");
	});

	it("names the clear button once there is a value", (): void => {
		render(<Fixture value="Banana" />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
	});

	it("applies the disabled, error and loading states", (): void => {
		const { rerender } = render(<Fixture disabled />, { wrapper: UiKitTestProviders });
		const input = screen.getByRole("combobox");
		expect(input).toHaveProperty("disabled", true);
		expect(input.className).toContain("cursor-not-allowed");
		rerender(<Fixture invalid />);
		expect(screen.getByRole("combobox").getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByRole("combobox").className).toContain("ring-destructive/20");
		rerender(<Fixture loading />);
		expect(screen.getByRole("combobox").dataset.loading).toBe("");
		expect(screen.getByRole("combobox").className).toContain("opacity-60");
	});

	it("forwards the input ref and merges className", (): void => {
		const ref = React.createRef<HTMLInputElement>();
		render(<Fixture inputRef={ref} className="font-mono" />, { wrapper: UiKitTestProviders });
		expect(ref.current?.dataset.slot).toBe("autocomplete-input");
		expect(ref.current?.className).toContain("font-mono");
		expect(ref.current?.className).toContain("pe-8");
	});
});
