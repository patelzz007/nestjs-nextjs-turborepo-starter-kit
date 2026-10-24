import { IMAGE_RESIZE_CORNER_HANDLES, type ImageSize } from "@workspace/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { defaultImageResizerHandleLabel, defaultImageResizerSizeText, ImageResizer } from "../image-resizer";

const URI = "https://cdn.example.com/kuih/platter.jpg";
const SIZE: ImageSize = { width: 200, height: 150 };

function touchAt(pageX: number, pageY: number): { readonly nativeEvent: { readonly pageX: number; readonly pageY: number } } {
	return { nativeEvent: { pageX, pageY } };
}

function action(actionName: string): { readonly nativeEvent: { readonly actionName: string } } {
	return { nativeEvent: { actionName } };
}

function grabLabel(): string {
	return "Grab";
}

function widthOnly(size: ImageSize): string {
	return `${String(size.width)}w`;
}

function handle(name: string): ReturnType<typeof screen.getByRole> {
	return screen.getByRole("adjustable", { name });
}

describe("ImageResizer", () => {
	it("draws the picture at the controlled size, named by its alt text", async () => {
		await render(<ImageResizer uri={URI} alt="Kuih platter" value={SIZE} onChange={jest.fn()} testID="resizer" />);

		expect(screen.getByTestId("resizer")).toHaveProp("style", SIZE);
		expect(screen.getByLabelText("Kuih platter")).toBeOnTheScreen();
		expect(screen.getByTestId("resizer-image")).toHaveProp("contentFit", "cover");
	});

	it("names every handle by where it sits and speaks the size as its value", async () => {
		await render(<ImageResizer uri={URI} alt="" value={SIZE} onChange={jest.fn()} />);

		expect(screen.getAllByRole("adjustable")).toHaveLength(8);
		expect(handle("Resize from the bottom-right corner")).toHaveProp("accessibilityValue", { text: "200 by 150 points" });
		expect(handle("Resize from the left edge")).toBeOnTheScreen();
		expect(defaultImageResizerHandleLabel("top")).toBe("Resize from the top edge");
		expect(defaultImageResizerSizeText(SIZE)).toBe("200 by 150 points");
	});

	it("shows only the handles asked for", async () => {
		await render(<ImageResizer uri={URI} alt="" value={SIZE} onChange={jest.fn()} handles={IMAGE_RESIZE_CORNER_HANDLES} />);
		expect(screen.getAllByRole("adjustable")).toHaveLength(4);
		expect(screen.queryByRole("adjustable", { name: "Resize from the top edge" })).toBeNull();
	});

	it("reports sizes while a handle is dragged, and the final one when let go", async () => {
		const onChange = jest.fn();
		const onChangeEnd = jest.fn();
		await render(<ImageResizer uri={URI} alt="" value={SIZE} onChange={onChange} onChangeEnd={onChangeEnd} maxWidth={260} />);
		const corner = handle("Resize from the bottom-right corner");

		await fireEvent(corner, "responderGrant", touchAt(100, 100));
		await fireEvent(corner, "responderMove", touchAt(130, 120));
		expect(onChange).toHaveBeenLastCalledWith({ width: 230, height: 170 });
		// Past the maximum width, the width stops there.
		await fireEvent(corner, "responderMove", touchAt(400, 120));
		expect(onChange).toHaveBeenLastCalledWith({ width: 260, height: 170 });
		expect(onChangeEnd).not.toHaveBeenCalled();

		await fireEvent(corner, "responderRelease", touchAt(400, 120));
		expect(onChangeEnd).toHaveBeenCalledTimes(1);
		expect(onChangeEnd).toHaveBeenCalledWith({ width: 260, height: 170 });
	});

	it("keeps the aspect ratio when given one, and reports nothing for a drag that changed nothing", async () => {
		const onChange = jest.fn();
		const onChangeEnd = jest.fn();
		await render(<ImageResizer uri={URI} alt="" value={SIZE} onChange={onChange} onChangeEnd={onChangeEnd} aspectRatio={4 / 3} />);
		const edge = handle("Resize from the left edge");

		await fireEvent(edge, "responderGrant", touchAt(50, 50));
		await fireEvent(edge, "responderMove", touchAt(10, 50));
		expect(onChange).toHaveBeenLastCalledWith({ width: 240, height: 180 });
		await fireEvent(edge, "responderMove", touchAt(50, 50));
		await fireEvent(edge, "responderTerminate", touchAt(50, 50));
		expect(onChangeEnd).not.toHaveBeenCalled();

		onChange.mockClear();
		await fireEvent(edge, "responderMove", touchAt(0, 0));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("grows and shrinks from a handle on screen-reader increments and decrements, within its bounds", async () => {
		const onChange = jest.fn();
		const onChangeEnd = jest.fn();
		await render(<ImageResizer uri={URI} alt="" value={SIZE} onChange={onChange} onChangeEnd={onChangeEnd} step={20} minHeight={150} />);

		await fireEvent(handle("Resize from the top-left corner"), "accessibilityAction", action("increment"));
		expect(onChange).toHaveBeenLastCalledWith({ width: 220, height: 170 });
		expect(onChangeEnd).toHaveBeenLastCalledWith({ width: 220, height: 170 });

		onChange.mockClear();
		await fireEvent(handle("Resize from the bottom edge"), "accessibilityAction", action("decrement"));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("shows the picture without handles while disabled", async () => {
		await render(<ImageResizer uri={URI} alt="" value={SIZE} onChange={jest.fn()} disabled testID="resizer" />);
		expect(screen.queryAllByRole("adjustable")).toHaveLength(0);
		expect(screen.getByTestId("resizer")).toHaveProp("className", expect.stringContaining("opacity-60"));
	});

	it("holds the space with a placeholder when there is no picture or it fails", async () => {
		const { rerender } = await render(<ImageResizer uri={null} alt="Kuih platter" value={SIZE} onChange={jest.fn()} testID="resizer" />);
		expect(screen.getByRole("image", { name: "Kuih platter" })).toBeOnTheScreen();

		await rerender(<ImageResizer uri={URI} alt="Kuih platter" value={SIZE} onChange={jest.fn()} testID="resizer" />);
		await fireEvent(screen.getByTestId("resizer-image"), "error", { nativeEvent: { error: "404" } });
		expect(screen.queryByTestId("resizer-image")).toBeNull();
		expect(screen.getByRole("image", { name: "Kuih platter" })).toBeOnTheScreen();
	});

	it("takes the caller's copy, look and fit, merging its className last", async () => {
		await render(
			<ImageResizer
				uri={URI}
				alt=""
				value={SIZE}
				onChange={jest.fn()}
				handleLabel={grabLabel}
				sizeText={widthOnly}
				variant="plain"
				size="sm"
				fit="contain"
				className="mt-4"
				testID="resizer"
			/>,
		);
		expect(screen.getAllByRole("adjustable", { name: "Grab" })).toHaveLength(8);
		expect(screen.getAllByRole("adjustable", { name: "Grab" }).at(0)).toHaveProp("accessibilityValue", { text: "200w" });
		const className = String(screen.getByTestId("resizer").props.className);
		expect(className).toContain("mt-4");
		expect(className).not.toContain("border-border");
		expect(screen.getByTestId("resizer-image")).toHaveProp("contentFit", "contain");
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<ImageResizer ref={ref} uri={URI} alt="" value={SIZE} onChange={jest.fn()} />);
		expect(ref.current).not.toBeNull();
	});
});
