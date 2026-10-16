// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stubLoadedImages } from "@workspace/ui/testing/loaded-image-stub";

import { ImageSlotField, type ImageSlotFieldLabels } from "./image-slot-field";

const LABELS: ImageSlotFieldLabels = {
	input: "Profile picture",
	image: "Your profile picture",
	upload: "Upload photo",
	replace: "Replace photo",
	remove: "Remove",
	busy: "Working…",
};

function renderField(overrides: Partial<React.ComponentProps<typeof ImageSlotField>> = {}): {
	readonly onPick: ReturnType<typeof vi.fn<(file: File) => void>>;
	readonly onRemove: ReturnType<typeof vi.fn<() => void>>;
} {
	const onPick = vi.fn<(file: File) => void>();
	const onRemove = vi.fn<() => void>();
	render(
		<ImageSlotField
			imageUrl={null}
			fallback="RU"
			shape="circle"
			labels={LABELS}
			accept="image/jpeg,image/png"
			hint="JPEG or PNG, up to 10 MB."
			isBusy={false}
			isReadOnly={false}
			onPick={onPick}
			onRemove={onRemove}
			{...overrides}
		/>,
	);
	return { onPick, onRemove };
}

function fileInput(): HTMLInputElement {
	const input = screen.getByLabelText("Profile picture");
	if (!(input instanceof HTMLInputElement)) {
		throw new Error("Profile picture is not an input");
	}
	return input;
}

describe("ImageSlotField", () => {
	afterEach(() => {
		cleanup();
	});

	it("offers an upload with a labelled, described file input limited to the given types", () => {
		renderField();

		expect(fileInput().accept).toBe("image/jpeg,image/png");
		expect(fileInput().getAttribute("aria-describedby")).toBe(screen.getByText("JPEG or PNG, up to 10 MB.").id);
		expect(screen.getByRole("button", { name: "Upload photo" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
		expect(screen.getByText("RU")).toBeTruthy();
	});

	it("hands the picked file to the caller", () => {
		const { onPick } = renderField();
		const image = new File([new Uint8Array(4)], "me.png", { type: "image/png" });

		fireEvent.change(fileInput(), { target: { files: [image] } });

		expect(onPick).toHaveBeenCalledWith(image);
	});

	it("offers replace and remove when there is an image", () => {
		const { onRemove } = renderField({ imageUrl: "https://cdn.example.com/a.png" });

		expect(screen.getByRole("button", { name: "Replace photo" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Remove" }));
		expect(onRemove).toHaveBeenCalledTimes(1);
	});

	it("says it is working, and disables every control, while busy", () => {
		renderField({ imageUrl: "https://cdn.example.com/a.png", isBusy: true });

		expect(screen.getByRole("button", { name: "Working…" }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Remove" }).hasAttribute("disabled")).toBe(true);
	});

	it("disables every control while read-only", () => {
		renderField({ imageUrl: "https://cdn.example.com/a.png", isReadOnly: true });

		expect(fileInput().disabled).toBe(true);
		expect(screen.getByRole("button", { name: "Replace photo" }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Remove" }).hasAttribute("disabled")).toBe(true);
	});

	it("frames a logo as a rounded square instead of a circle", () => {
		renderField({ shape: "rounded" });

		expect(document.querySelector('[data-slot="avatar"]')?.className).toContain("rounded-xl");
		expect(document.querySelector('[data-slot="avatar"]')?.className).not.toContain("rounded-full");
	});

	it("previews the image from its renditions at the 64 px it is drawn", () => {
		const restoreImages = stubLoadedImages();
		renderField({ imageUrl: "https://cdn.example.com/a.webp", imageSources: [{ width: 128, url: "https://cdn.example.com/a-thumbnail.webp" }] });

		const preview = screen.getByRole("img", { name: "Your profile picture" });
		expect(preview.getAttribute("srcset")).toBe("https://cdn.example.com/a-thumbnail.webp 128w");
		expect(preview.getAttribute("sizes")).toBe("64px");
		restoreImages();
	});
});
