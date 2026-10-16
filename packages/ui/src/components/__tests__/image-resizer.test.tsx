// @vitest-environment jsdom
import { IMAGE_RESIZE_CORNER_HANDLES, type ImageSize } from "@workspace/shared";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { ImageResizer } from "../image-resizer";

const SRC = "https://cdn.example.com/kuih/platter.webp";
const SIZE: ImageSize = { width: 400, height: 300 };
const POINTER = 1;

/** The detached images the resizer loads through (useImageLoadingStatus), so a test can finish a load. */
const loaders: HTMLImageElement[] = [];
const NativeImage = window.Image;

beforeEach((): void => {
	loaders.length = 0;
	window.Image = class extends NativeImage {
		public constructor() {
			super();
			loaders.push(this);
		}
	};
	// jsdom has no pointer capture.
	HTMLElement.prototype.setPointerCapture = vi.fn();
});

afterEach((): void => {
	cleanup();
	window.Image = NativeImage;
});

function finishLoad(event: "load" | "error"): void {
	const loader = loaders.at(-1);
	if (loader === undefined) {
		throw new Error("the resizer started no load");
	}
	act((): void => {
		loader.dispatchEvent(new Event(event));
	});
}

function frame(): HTMLElement {
	const element = document.querySelector<HTMLElement>('[data-slot="image-resizer"]');
	if (element === null) {
		throw new Error("image-resizer frame not rendered");
	}
	return element;
}

function handle(name: string): HTMLElement {
	return screen.getByRole("button", { name });
}

interface Callbacks {
	readonly onValueChange: ReturnType<typeof vi.fn>;
	readonly onValueCommitted: ReturnType<typeof vi.fn>;
}

function renderResizer(props: Partial<React.ComponentProps<typeof ImageResizer>> = {}): Callbacks {
	const onValueChange = vi.fn();
	const onValueCommitted = vi.fn();
	render(<ImageResizer src={SRC} alt="Kuih platter" value={SIZE} onValueChange={onValueChange} onValueCommitted={onValueCommitted} {...props} />, {
		wrapper: UiKitTestProviders,
	});
	return { onValueChange, onValueCommitted };
}

describe("ImageResizer", () => {
	it("draws the image at the controlled size, fading it in once loaded", () => {
		renderResizer();

		expect(frame().style.width).toBe("400px");
		expect(frame().style.height).toBe("300px");
		const image = screen.getByRole("img", { name: "Kuih platter" });
		expect(image.className).toContain("opacity-0");
		finishLoad("load");
		expect(image.className).toContain("opacity-100");
		expect(image.className).toContain("object-cover");
	});

	it("names every handle by where it sits, and describes how to use it", () => {
		renderResizer();

		expect(screen.getAllByRole("button")).toHaveLength(8);
		const corner = handle("Resize from the bottom-right corner");
		const description = document.getElementById(corner.getAttribute("aria-describedby") ?? "");
		expect(description?.textContent).toContain("arrow keys");
		expect(handle("Resize from the left edge")).toBeDefined();
	});

	it("shows only the handles asked for", () => {
		renderResizer({ handles: IMAGE_RESIZE_CORNER_HANDLES });
		expect(screen.getAllByRole("button").map((button) => button.dataset.handle)).toEqual(["top-left", "top-right", "bottom-right", "bottom-left"]);
	});

	it("reports sizes while a handle is dragged, and the final one once let go", () => {
		const { onValueChange, onValueCommitted } = renderResizer({ maxWidth: 450 });
		const corner = handle("Resize from the bottom-right corner");

		fireEvent.pointerDown(corner, { pointerId: POINTER, button: 0, clientX: 100, clientY: 100 });
		fireEvent.pointerMove(corner, { pointerId: POINTER, clientX: 130, clientY: 120 });
		expect(onValueChange).toHaveBeenLastCalledWith({ width: 430, height: 320 });
		// Past the maximum width, the width stops there.
		fireEvent.pointerMove(corner, { pointerId: POINTER, clientX: 400, clientY: 120 });
		expect(onValueChange).toHaveBeenLastCalledWith({ width: 450, height: 320 });
		expect(document.activeElement).toBe(corner);
		expect(onValueCommitted).not.toHaveBeenCalled();

		fireEvent.pointerUp(corner, { pointerId: POINTER, clientX: 400, clientY: 120 });
		expect(onValueCommitted).toHaveBeenCalledTimes(1);
		expect(onValueCommitted).toHaveBeenCalledWith({ width: 450, height: 320 });
	});

	it("keeps the aspect ratio when given one", () => {
		const { onValueChange } = renderResizer({ aspectRatio: 4 / 3 });
		const edge = handle("Resize from the right edge");

		fireEvent.pointerDown(edge, { pointerId: POINTER, button: 0, clientX: 0, clientY: 0 });
		fireEvent.pointerMove(edge, { pointerId: POINTER, clientX: 80, clientY: 0 });
		expect(onValueChange).toHaveBeenLastCalledWith({ width: 480, height: 360 });
	});

	it("ignores other pointers, secondary buttons and moves without a drag", () => {
		const { onValueChange, onValueCommitted } = renderResizer();
		const corner = handle("Resize from the bottom-right corner");

		fireEvent.pointerMove(corner, { pointerId: POINTER, clientX: 130, clientY: 120 });
		fireEvent.pointerDown(corner, { pointerId: POINTER, button: 2, clientX: 0, clientY: 0 });
		fireEvent.pointerMove(corner, { pointerId: POINTER, clientX: 130, clientY: 120 });
		fireEvent.pointerDown(corner, { pointerId: POINTER, button: 0, clientX: 0, clientY: 0 });
		fireEvent.pointerMove(corner, { pointerId: 2, clientX: 130, clientY: 120 });
		fireEvent.pointerUp(corner, { pointerId: POINTER, clientX: 0, clientY: 0 });

		expect(onValueChange).not.toHaveBeenCalled();
		expect(onValueCommitted).not.toHaveBeenCalled();
	});

	it("cancels a drag on Escape, back to the size it started at", () => {
		const { onValueChange, onValueCommitted } = renderResizer();
		const corner = handle("Resize from the top-left corner");

		fireEvent.pointerDown(corner, { pointerId: POINTER, button: 0, clientX: 100, clientY: 100 });
		fireEvent.pointerMove(corner, { pointerId: POINTER, clientX: 50, clientY: 100 });
		expect(onValueChange).toHaveBeenLastCalledWith({ width: 450, height: 300 });
		fireEvent.keyDown(corner, { key: "Escape" });
		expect(onValueChange).toHaveBeenLastCalledWith(SIZE);
		fireEvent.pointerUp(corner, { pointerId: POINTER, clientX: 50, clientY: 100 });
		expect(onValueCommitted).not.toHaveBeenCalled();
	});

	it("steps with the arrow keys (Shift for larger steps), commits each step and announces the size", () => {
		const { onValueChange, onValueCommitted } = renderResizer({ step: 5, largeStep: 40 });
		const corner = handle("Resize from the bottom-right corner");

		fireEvent.keyDown(corner, { key: "ArrowRight" });
		expect(onValueChange).toHaveBeenLastCalledWith({ width: 405, height: 300 });
		expect(onValueCommitted).toHaveBeenLastCalledWith({ width: 405, height: 300 });
		expect(screen.getByRole("status").textContent).toBe("405 by 300 pixels");

		fireEvent.keyDown(corner, { key: "ArrowUp", shiftKey: true });
		expect(onValueChange).toHaveBeenLastCalledWith({ width: 400, height: 260 });
		fireEvent.keyDown(handle("Resize from the left edge"), { key: "ArrowRight" });
		expect(onValueChange).toHaveBeenLastCalledWith({ width: 395, height: 300 });
	});

	it("ignores keys that would not change the size", () => {
		const { onValueChange } = renderResizer({ minHeight: 300 });

		fireEvent.keyDown(handle("Resize from the right edge"), { key: "ArrowDown" });
		fireEvent.keyDown(handle("Resize from the bottom edge"), { key: "ArrowUp" });
		fireEvent.keyDown(handle("Resize from the bottom edge"), { key: "Enter" });
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("shows the image without handles while disabled", () => {
		renderResizer({ disabled: true });
		expect(screen.queryAllByRole("button")).toHaveLength(0);
		expect(frame().dataset.disabled).toBe("");
		expect(frame().className).toContain("opacity-60");
	});

	it("shows the fallback, still named, when the image fails to load", () => {
		renderResizer({ fallback: <span>No image</span> });
		finishLoad("error");
		expect(screen.queryByRole("img")).toBeNull();
		expect(screen.getByText("No image")).toBeDefined();
		expect(screen.getByText("Kuih platter").className).toContain("sr-only");
	});

	it("takes the caller's copy, variant, fit and classes", () => {
		renderResizer({ labels: { handle: () => "Grab" }, variant: "ghost", size: "sm", fit: "contain", className: "my-4" });
		expect(screen.getAllByRole("button", { name: "Grab" })).toHaveLength(8);
		expect(frame().className).toContain("my-4");
		expect(frame().className).toContain("hover:ring-1");
		expect(screen.getAllByRole("button", { name: "Grab" }).at(0)?.className).toContain("size-6");
		expect(screen.getByRole("img").className).toContain("object-contain");
	});

	it("rejects bounds no size fits", () => {
		vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect(() => renderResizer({ minWidth: 500, maxWidth: 100 })).toThrow("a minimum is larger than its maximum");
		vi.restoreAllMocks();
	});

	it("forwards its ref to the frame", () => {
		const ref = React.createRef<HTMLDivElement>();
		render(<ImageResizer ref={ref} src={SRC} alt="" value={SIZE} onValueChange={vi.fn()} />, { wrapper: UiKitTestProviders });
		expect(ref.current).toBe(frame());
	});
});
