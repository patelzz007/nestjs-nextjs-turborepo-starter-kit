import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { ColorPicker, ColorPickerAlpha, ColorPickerArea, ColorPickerField, ColorPickerHue, ColorPickerInput, ColorPickerSwatch, hueOf } from "../color-picker";

const PRESETS: readonly string[] = ["#ef4444", "#3b82f6"];

/** A layout event giving a box of the size a finger drags across. */
function layoutOf(width: number, height: number): { readonly nativeEvent: { readonly layout: { readonly width: number; readonly height: number } } } {
	return { nativeEvent: { layout: { width, height } } };
}

describe("ColorPickerArea", () => {
	it("picks saturation and brightness where it is touched, keeping the hue", async () => {
		const onChange = jest.fn();
		await render(<ColorPickerArea value="#ff0000" onChange={onChange} testID="area" />);
		const area = screen.getByTestId("area");
		await fireEvent(area, "layout", layoutOf(200, 100));
		await fireEvent(area, "responderGrant", { nativeEvent: { locationX: 200, locationY: 0 } });
		expect(onChange).toHaveBeenLastCalledWith("#ff0000");
		await fireEvent(area, "responderMove", { nativeEvent: { locationX: 0, locationY: 100 } });
		expect(onChange).toHaveBeenLastCalledWith("#000000");
	});

	it("is adjustable for screen readers", async () => {
		const onChange = jest.fn();
		await render(<ColorPickerArea value="#808080" onChange={onChange} testID="area" />);
		const area = screen.getByTestId("area");
		expect(area).toHaveProp("accessibilityRole", "adjustable");
		await fireEvent(area, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
		expect(onChange).toHaveBeenCalledTimes(1);
	});
});

describe("ColorPickerHue and ColorPickerAlpha", () => {
	it("move the hue along the rainbow, and the opacity from clear to solid", async () => {
		const onChange = jest.fn();
		await render(<ColorPickerHue value="#ff0000" onChange={onChange} testID="hue" />);
		const hue = screen.getByTestId("hue");
		await fireEvent(hue, "layout", layoutOf(360, 24));
		await fireEvent(hue, "responderGrant", { nativeEvent: { locationX: 120, locationY: 12 } });
		expect(onChange).toHaveBeenLastCalledWith("#00ff00");

		await render(<ColorPickerAlpha value="#ff0000" onChange={onChange} testID="alpha" />);
		const alpha = screen.getByTestId("alpha");
		await fireEvent(alpha, "layout", layoutOf(100, 24));
		await fireEvent(alpha, "responderGrant", { nativeEvent: { locationX: 50, locationY: 12 } });
		expect(onChange).toHaveBeenLastCalledWith("#ff000080");
		await fireEvent(alpha, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
		expect(onChange).toHaveBeenCalledTimes(3);
	});
});

describe("ColorPickerInput", () => {
	it("writes the colour in the chosen form, and reads a typed one when left", async () => {
		const onChange = jest.fn();
		const onFormatChange = jest.fn();
		await render(<ColorPickerInput value="#3b82f6" onChange={onChange} format="rgb" onFormatChange={onFormatChange} testID="input" />);
		const input = screen.getByTestId("input");
		expect(input).toHaveProp("value", "rgb(59, 130, 246)");
		await fireEvent.changeText(input, "hsl(0, 100%, 50%)");
		await fireEvent(input, "blur");
		expect(onChange).toHaveBeenLastCalledWith("#ff0000");
		await fireEvent.press(screen.getByRole("radio", { name: "OKLCH" }));
		expect(onFormatChange).toHaveBeenCalledWith("oklch");
	});

	it("puts back text that is not a colour", async () => {
		const onChange = jest.fn();
		await render(<ColorPickerInput value="#3b82f6" onChange={onChange} testID="input" />);
		const input = screen.getByTestId("input");
		await fireEvent.changeText(input, "not a colour");
		await fireEvent(input, "submitEditing");
		expect(onChange).not.toHaveBeenCalled();
		expect(input).toHaveProp("value", "#3b82f6");
	});
});

describe("ColorPickerSwatch and ColorPicker", () => {
	it("shows a colour, or offers it to pick, marking the picked one", async () => {
		const onChange = jest.fn();
		await render(<ColorPicker value="#3b82f6" onChange={onChange} presets={PRESETS} showAlpha />);
		expect(screen.getByRole("button", { name: "#3b82f6" })).toHaveProp("accessibilityState", { selected: true });
		await fireEvent.press(screen.getByRole("button", { name: "#ef4444" }));
		expect(onChange).toHaveBeenCalledWith("#ef4444");
		expect(screen.getByLabelText("Opacity")).toBeOnTheScreen();

		await render(<ColorPickerSwatch color="#00ff00" label="Green" />);
		expect(screen.getByRole("image", { name: "Green" })).toBeOnTheScreen();
	});

	it("gives a hue for building palettes", () => {
		expect(hueOf("#00ff00")).toBe(120);
	});
});

describe("ColorPickerField", () => {
	it("shows the colour and opens the picker in a sheet", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<ColorPickerField ref={ref} label="Brand colour" value="#3b82f6" onChange={jest.fn()} testID="field" />);
		await fireEvent.press(screen.getByRole("button", { name: "Brand colour, #3b82f6" }));
		expect(within(screen.getByTestId("field-sheet")).getByLabelText("Hue")).toBeOnTheScreen();
		expect(ref.current).not.toBeNull();
	});
});
