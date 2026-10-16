// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CropArea } from "../lib/media/crop-area";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { ImageCropper } from "./image-cropper";

afterEach((): void => {
	cleanup();
});

const BOUNDS = { width: 6000, height: 4000 };
const WIDE = 16 / 9;
const AREA: CropArea = { x: 1000, y: 1000, width: 3840, height: 2160 };

function frame(): HTMLElement {
	return screen.getByRole("img", { name: "Crop preview" });
}

/**
 * The slider whose label reads `name`. Base UI keeps thumbs `visibility: hidden`
 * until it has measured the track — which jsdom never lays out — and a hidden
 * element gets no computed name, so the label is followed through `aria-labelledby`.
 */
function querySlider(name: string): HTMLElement | null {
	return screen.queryAllByRole("slider", { hidden: true }).find((input) => document.getElementById(input.getAttribute("aria-labelledby") ?? "")?.textContent === name) ?? null;
}

function slider(name: string): HTMLElement {
	const found = querySlider(name);
	if (found === null) {
		throw new Error(`No slider labelled "${name}"`);
	}
	return found;
}

function renderCropper(props: Partial<React.ComponentProps<typeof ImageCropper>> = {}): ReturnType<typeof vi.fn> {
	const onValueChange = vi.fn();
	render(<ImageCropper src="blob:photo" bounds={BOUNDS} aspect={WIDE} minCropWidth={3840} value={AREA} onValueChange={onValueChange} {...props} />, {
		wrapper: UiKitTestProviders,
	});
	return onValueChange;
}

describe("ImageCropper", () => {
	it("draws exactly the crop in the frame", (): void => {
		renderCropper();

		const image = frame().querySelector("img");
		expect(image?.style.width).toBe(`${String((6000 / 3840) * 100)}%`);
		expect(image?.style.left).toBe(`${String((-1000 / 3840) * 100)}%`);
		expect(image?.style.top).toBe(`${String((-1000 / 2160) * 100)}%`);
	});

	it("offers zoom and both position sliders when the photo has room each way", (): void => {
		renderCropper();

		expect(slider("Zoom").getAttribute("aria-valuenow")).toBe(String(6000 / 3840));
		expect(slider("Left to right").getAttribute("aria-valuenow")).toBe(String(1000 / 2160));
		expect(slider("Top to bottom").getAttribute("aria-valuenow")).toBe(String(1000 / 1840));
	});

	it("moves the crop from the keyboard through the position sliders, staying inside the photo", (): void => {
		const onValueChange = renderCropper();

		fireEvent.keyDown(slider("Left to right"), { key: "End" });
		expect(onValueChange).toHaveBeenLastCalledWith({ ...AREA, x: 2160 });
		fireEvent.keyDown(slider("Top to bottom"), { key: "Home" });
		expect(onValueChange).toHaveBeenLastCalledWith({ ...AREA, y: 0 });
	});

	it("zooms out to the whole width, and in no further than the minimum width", (): void => {
		const onValueChange = renderCropper({ value: { x: 600, y: 1300, width: 4800, height: 2700 } });

		fireEvent.keyDown(slider("Zoom"), { key: "Home" });
		expect(onValueChange).toHaveBeenLastCalledWith({ x: 0, y: 625, width: 6000, height: 3375 });
		fireEvent.keyDown(slider("Zoom"), { key: "End" });
		expect(onValueChange).toHaveBeenLastCalledWith({ x: 1080, y: 1570, width: 3840, height: 2160 });
	});

	it("shows only the sliders that can change something", (): void => {
		renderCropper({ bounds: { width: 3840, height: 2400 }, value: { x: 0, y: 120, width: 3840, height: 2160 } });

		expect(querySlider("Zoom")).toBeNull();
		expect(querySlider("Left to right")).toBeNull();
		expect(slider("Top to bottom")).toBeDefined();
	});

	it("moves the crop when the photo is dragged, the opposite way to the pointer", (): void => {
		const onValueChange = renderCropper();
		HTMLElement.prototype.setPointerCapture = vi.fn();
		vi.spyOn(frame(), "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ width: 384, height: 216 }));

		fireEvent.pointerDown(frame(), { pointerId: 1, clientX: 100, clientY: 100 });
		fireEvent.pointerMove(frame(), { pointerId: 1, clientX: 110, clientY: 95 });
		expect(onValueChange).toHaveBeenLastCalledWith({ ...AREA, x: 900, y: 1050 });
	});

	it("ignores input while disabled", (): void => {
		const onValueChange = renderCropper({ disabled: true });
		HTMLElement.prototype.setPointerCapture = vi.fn();

		fireEvent.pointerDown(frame(), { pointerId: 1, clientX: 100, clientY: 100 });
		fireEvent.pointerMove(frame(), { pointerId: 1, clientX: 200, clientY: 100 });
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("zooms out only until the photo fills the frame, by default", (): void => {
		const onValueChange = renderCropper({ value: { x: 600, y: 1300, width: 4800, height: 2700 } });

		fireEvent.keyDown(slider("Zoom"), { key: "Home" });
		expect(onValueChange).toHaveBeenLastCalledWith({ x: 0, y: 625, width: 6000, height: 3375 });
		expect(frame().querySelector('[data-slot="image-cropper-backdrop"]')).toBeNull();
	});

	it("zooms out to the whole photo when allowed, centring it, with a blurred copy around it", (): void => {
		const onValueChange = renderCropper({ zoomOutLimit: "whole-photo", value: { x: 0, y: 312, width: 6000, height: 3375 } });

		fireEvent.keyDown(slider("Zoom"), { key: "Home" });
		expect(onValueChange).toHaveBeenLastCalledWith({ x: -556, y: -1, width: 7112, height: 4001 });
	});

	it("draws the whole photo centred over its blurred copy when the crop is wider than the photo", (): void => {
		renderCropper({ zoomOutLimit: "whole-photo", value: { x: -556, y: -1, width: 7112, height: 4001 } });

		const backdrop = frame().querySelector('[data-slot="image-cropper-backdrop"]');
		expect(backdrop?.getAttribute("src")).toBe("blob:photo");
		const photo = frame().querySelector("img:not([data-slot])");
		expect(photo).toBeInstanceOf(HTMLImageElement);
		expect(photo instanceof HTMLImageElement ? photo.style.left : "").toBe(`${String((556 / 7112) * 100)}%`);
		expect(querySlider("Left to right")).toBeNull();
		expect(querySlider("Top to bottom")).toBeNull();
	});
});
