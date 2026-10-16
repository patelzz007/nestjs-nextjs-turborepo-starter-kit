// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PhoneInput, type PhoneInputProps } from "../phone-input";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";

/** jsdom has no ResizeObserver; base-ui's popup expects one. */
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

interface FixtureProps extends PhoneInputProps {
	readonly inputRef?: React.Ref<HTMLInputElement>;
}

const COUNTRIES: ["MY", "SG", "US"] = ["MY", "SG", "US"];

function Fixture({ inputRef, invalid, ...props }: FixtureProps & { readonly invalid?: boolean }): React.JSX.Element {
	return <PhoneInput ref={inputRef} aria-label="Phone number" defaultCountry="MY" countries={COUNTRIES} aria-invalid={invalid} {...props} />;
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("PhoneInput", () => {
	it("renders the number field and a country button named by the selected country", (): void => {
		render(<Fixture />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("textbox", { name: "Phone number" })).toBeTruthy();
		expect(screen.getByRole("combobox", { name: "Country: Malaysia" })).toBeTruthy();
	});

	it("reports the typed number in E.164 and an emptied field as an empty string", (): void => {
		const onChange = vi.fn();
		render(<Fixture onChange={onChange} />, { wrapper: UiKitTestProviders });
		const input = screen.getByRole("textbox", { name: "Phone number" });
		fireEvent.change(input, { target: { value: "0123456789" } });
		expect(onChange).toHaveBeenLastCalledWith("+60123456789");
		fireEvent.change(input, { target: { value: "" } });
		expect(onChange).toHaveBeenLastCalledWith("");
	});

	it("shows a controlled value formatted for its country", (): void => {
		const { rerender } = render(<Fixture value="+60123456789" />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("textbox").getAttribute("value")).toBe("+60 12 345 6789");
		rerender(<Fixture value="" />);
		expect(screen.getByRole("textbox")).toHaveProperty("value", "");
	});

	it("searches countries in the picker and switches the country", async (): Promise<void> => {
		render(<Fixture />, { wrapper: UiKitTestProviders });
		fireEvent.click(screen.getByRole("combobox", { name: "Country: Malaysia" }));
		const search = await screen.findByPlaceholderText("e.g. United States");
		expect(screen.getAllByRole("option", { hidden: true })).toHaveLength(3);
		fireEvent.change(search, { target: { value: "sing" } });
		const options = await screen.findAllByRole("option", { hidden: true });
		const [onlyOption] = options;
		expect(options).toHaveLength(1);
		expect(onlyOption?.textContent).toContain("+65");
		fireEvent.click(screen.getByRole("option", { name: /Singapore/, hidden: true }));
		expect(await screen.findByRole("combobox", { name: "Country: Singapore", hidden: true })).toBeTruthy();
	});

	it("shows the empty state when no country matches", async (): Promise<void> => {
		render(<Fixture />, { wrapper: UiKitTestProviders });
		fireEvent.click(screen.getByRole("combobox", { name: "Country: Malaysia" }));
		fireEvent.change(await screen.findByPlaceholderText("e.g. United States"), { target: { value: "zzz" } });
		expect(await screen.findByText("No country found.")).toBeTruthy();
		expect(screen.queryAllByRole("option", { hidden: true })).toHaveLength(0);
	});

	it("disables the number field and the country button", (): void => {
		render(<Fixture disabled />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
		expect(screen.getByRole("combobox", { name: "Country: Malaysia" })).toHaveProperty("disabled", true);
	});

	it("marks the number field invalid and reddens the country button", (): void => {
		const { container } = render(<Fixture invalid />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
		expect(container.querySelector('[data-slot="phone-input"]')?.className).toContain("**:data-[slot=combobox-trigger]:border-destructive");
	});

	it("forwards its ref to the number input, sizes it and merges className", (): void => {
		const ref = React.createRef<HTMLInputElement>();
		const { container } = render(<Fixture inputRef={ref} className="w-72" variant="lg" />, { wrapper: UiKitTestProviders });
		expect(ref.current).toBe(screen.getByRole("textbox"));
		expect(ref.current?.className).toContain("h-10");
		expect(container.querySelector('[data-slot="phone-input"]')?.className).toContain("w-72");
	});
});
