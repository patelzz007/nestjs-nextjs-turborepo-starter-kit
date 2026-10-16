// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { stubResizeObserverForCalendarDropdowns } from "@workspace/ui/testing/calendar-dropdowns";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	ColorPicker,
	ColorPickerArea,
	ColorPickerClear,
	ColorPickerFields,
	ColorPickerInput,
	ColorPickerPanel,
	ColorPickerSlider,
	ColorPickerSwatch,
	ColorPickerSwatches,
	ColorPickerWheel,
	useColorPicker,
} from "./color-picker";

beforeEach((): void => {
	stubResizeObserverForCalendarDropdowns();
	/* jsdom has no layout, so no scrollIntoView; the swatch listbox scrolls its active option into view. */
	Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

function renderWithLabels(ui: React.ReactElement): ReturnType<typeof render> {
	return render(ui, { wrapper: UiKitTestProviders });
}

describe("ColorPicker", () => {
	it("renders a trigger with the placeholder while empty, and the value in capitals once set", (): void => {
		const { rerender } = renderWithLabels(<ColorPicker aria-label="Brand colour" />);
		const trigger = screen.getByRole("button", { name: "Brand colour" });
		expect(trigger.textContent).toContain("Select color");
		expect(trigger.dataset.placeholder).toBe("");
		rerender(<ColorPicker aria-label="Brand colour" value="#3366ff" />);
		expect(screen.getByRole("button", { name: "Brand colour" }).textContent).toContain("#3366FF");
	});

	it("forwards its ref to the trigger and merges className last", (): void => {
		const ref = React.createRef<HTMLElement>();
		renderWithLabels(<ColorPicker ref={ref} aria-label="Colour" className="w-40" />);
		expect(ref.current?.dataset.slot).toBe("color-picker-trigger");
		expect(ref.current?.className).toContain("w-40");
	});

	it("opens a labelled panel with the area, hue slider and fields", (): void => {
		renderWithLabels(<ColorPicker aria-label="Colour" defaultValue="#ff0000" />);
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Colour" }));
		});
		expect(screen.getByRole("dialog", { name: "Colour" })).toBeTruthy();
		const area = screen.getByRole("slider", { name: "Color" });
		expect(area.getAttribute("aria-valuetext")).toBe("Saturation 100%, Brightness 100%, vibrant red");
		expect(screen.getByRole("slider", { name: "Hue" }).getAttribute("aria-valuetext")).toBe("0°, vibrant red");
		expect(screen.getByRole("textbox", { name: "Hex" })).toHaveProperty("value", "FF0000");
		expect(screen.getByRole("button", { name: "Color format, HEX" })).toBeTruthy();
	});

	it("emits each change and commits once an interaction ends, in the chosen format", (): void => {
		const onValueChange = vi.fn();
		const onValueCommit = vi.fn();
		renderWithLabels(
			<ColorPicker defaultValue="#ff0000" format="hsl" onValueChange={onValueChange} onValueCommit={onValueCommit}>
				<ColorPickerSlider channel="hue" />
			</ColorPicker>,
		);
		fireEvent.keyDown(screen.getByRole("slider", { name: "Hue" }), { key: "ArrowRight", shiftKey: true });
		expect(onValueChange).toHaveBeenCalledWith("hsl(10 100% 50%)");
		expect(onValueCommit).toHaveBeenCalledWith("hsl(10 100% 50%)");
	});

	it("stays on a controlled value until the parent updates it", (): void => {
		const onValueChange = vi.fn();
		renderWithLabels(
			<ColorPicker value="#000000" onValueChange={onValueChange}>
				<ColorPickerArea />
			</ColorPicker>,
		);
		const area = screen.getByRole("slider", { name: "Color" });
		fireEvent.keyDown(area, { key: "ArrowUp" });
		expect(onValueChange).toHaveBeenCalledWith("#030303");
		expect(area.getAttribute("aria-valuetext")).toContain("Brightness 0%");
	});

	it("disables every control and paints the disabled state", (): void => {
		const onValueChange = vi.fn();
		renderWithLabels(
			<ColorPicker disabled value="#ff0000" onValueChange={onValueChange}>
				<ColorPickerPanel>
					<ColorPickerArea />
				</ColorPickerPanel>
			</ColorPicker>,
		);
		const area = screen.getByRole("slider", { name: "Color" });
		expect(area.getAttribute("aria-disabled")).toBe("true");
		expect(area.tabIndex).toBe(-1);
		expect(area.className).toContain("opacity-50");
		fireEvent.keyDown(area, { key: "ArrowRight" });
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("marks the trigger invalid", (): void => {
		renderWithLabels(<ColorPicker aria-label="Colour" invalid />);
		expect(screen.getByRole("button", { name: "Colour" }).getAttribute("aria-invalid")).toBe("true");
	});

	it("reads typed colours in ColorPickerInput on Enter, and Escape restores the value", (): void => {
		const onValueChange = vi.fn();
		const inputRef = React.createRef<HTMLInputElement>();
		renderWithLabels(
			<ColorPicker aria-label="Colour" defaultValue="#ffffff" onValueChange={onValueChange}>
				<ColorPickerInput ref={inputRef} />
			</ColorPicker>,
		);
		const input = screen.getByRole("textbox", { name: "Colour" });
		expect(inputRef.current).toBe(input);
		fireEvent.change(input, { target: { value: "rebeccapurple" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(onValueChange).toHaveBeenCalledWith("#663399");
		expect(input).toHaveProperty("value", "#663399".toUpperCase());

		fireEvent.change(input, { target: { value: "red" } });
		fireEvent.keyDown(input, { key: "Escape" });
		expect(input).toHaveProperty("value", "#663399".toUpperCase());
	});

	it("picks a swatch from the listbox by keyboard", (): void => {
		const onValueChange = vi.fn();
		renderWithLabels(
			<ColorPicker onValueChange={onValueChange}>
				<ColorPickerSwatches colors={["#ff0000", { value: "#00ff00", label: "Leaf" }]} />
			</ColorPicker>,
		);
		const listbox = screen.getByRole("listbox", { name: "Swatches" });
		expect(screen.getByRole("option", { name: "Leaf" })).toBeTruthy();
		fireEvent.keyDown(listbox, { key: "End" });
		fireEvent.keyDown(listbox, { key: "Enter" });
		expect(onValueChange).toHaveBeenCalledWith("#00ff00");
		expect(screen.getByRole("option", { name: "Leaf" }).getAttribute("aria-selected")).toBe("true");
	});

	it("steps a channel field with the arrow keys, ten at a time with Shift", (): void => {
		const onValueChange = vi.fn();
		renderWithLabels(
			<ColorPicker defaultValue="#000000" onValueChange={onValueChange}>
				<ColorPickerFields defaultFormat="rgb" />
			</ColorPicker>,
		);
		const red = screen.getByRole("spinbutton", { name: "Red" });
		fireEvent.keyDown(red, { key: "ArrowUp", shiftKey: true });
		expect(onValueChange).toHaveBeenCalledWith("#0a0000");
	});

	it("renders an inline panel as a labelled group, a wheel, and an empty-able value", (): void => {
		const onValueChange = vi.fn();
		renderWithLabels(
			<ColorPicker defaultValue="#ff0000" onValueChange={onValueChange}>
				<ColorPickerPanel>
					<ColorPickerWheel />
					<ColorPickerClear />
				</ColorPickerPanel>
			</ColorPicker>,
		);
		expect(screen.getByRole("group", { name: "Choose color" })).toBeTruthy();
		fireEvent.keyDown(screen.getByRole("slider", { name: "Hue" }), { key: "End" });
		expect(onValueChange).toHaveBeenLastCalledWith("#ff0004");
		fireEvent.click(screen.getByRole("button", { name: "Clear" }));
		expect(onValueChange).toHaveBeenLastCalledWith(null);
	});

	it("submits the value through a hidden field and restores it on form reset", async (): Promise<void> => {
		const { container } = renderWithLabels(
			<form>
				<ColorPicker name="accent" defaultValue="#112233">
					<ColorPickerSlider channel="red" />
				</ColorPicker>
			</form>,
		);
		const field = container.querySelector<HTMLInputElement>('input[name="accent"]');
		expect(field?.value).toBe("#112233");
		fireEvent.keyDown(screen.getByRole("slider", { name: "Red" }), { key: "Home" });
		expect(field?.value).toBe("#002233");
		await act(async (): Promise<void> => {
			container.querySelector("form")?.reset();
			await new Promise((resolve: (value: null) => void): void => {
				setTimeout((): void => {
					resolve(null);
				});
			});
		});
		expect(field?.value).toBe("#112233");
	});

	it("exposes its state through useColorPicker", (): void => {
		function Probe(): React.JSX.Element {
			const picker = useColorPicker();
			const handleClick = React.useCallback((): void => {
				picker.setValue("blue");
			}, [picker]);
			return (
				<button type="button" onClick={handleClick}>
					{picker.value ?? "empty"}
				</button>
			);
		}
		renderWithLabels(
			<ColorPicker>
				<Probe />
			</ColorPicker>,
		);
		const probe = screen.getByRole("button", { name: "empty" });
		fireEvent.click(probe);
		expect(probe.textContent).toBe("#0000ff");
	});

	it("renders a standalone swatch outside a picker, with a ref and merged className", (): void => {
		const ref = React.createRef<HTMLSpanElement>();
		renderWithLabels(<ColorPickerSwatch ref={ref} color="#ff000080" aria-label="Half red" shape="circle" className="size-6" />);
		const swatch = screen.getByRole("img", { name: "Half red" });
		expect(ref.current).toBe(swatch);
		expect(swatch.className).toContain("rounded-full");
		expect(swatch.className).toContain("size-6");
		expect(swatch.style.background).toContain("repeating-conic-gradient");
	});

	it("overrides copy per usage through i18n", (): void => {
		renderWithLabels(
			<ColorPicker i18n={{ labels: { area: "Shade" }, functions: { getColorName: (): string => "custom" } }} defaultValue="#ff0000">
				<ColorPickerArea />
			</ColorPicker>,
		);
		expect(screen.getByRole("slider", { name: "Shade" }).getAttribute("aria-valuetext")).toContain("custom");
	});
});
