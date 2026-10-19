// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AVATAR_IMAGE_RULES } from "../../contexts/identity/profile/profile-avatar";
import type { ImageCropDialogProps, ImageCropSource } from "../image-crop-dialog";
import ImageCropDialogClientOnly from "../image-crop-dialog.client-only";

// The cropper itself needs canvas and ImageBitmap (absent in jsdom); this file tests the lazy wrapper, so the
// dialog it loads is a stand-in that shows which props arrived.
vi.mock("../image-crop-dialog", () => ({
	ImageCropDialog: ({ source, title }: ImageCropDialogProps): React.JSX.Element => <p>{`${title}: ${source?.id ?? "none"}`}</p>,
}));

const BASE_PROPS: Omit<ImageCropDialogProps, "source"> = {
	rules: AVATAR_IMAGE_RULES,
	title: "Crop your photo",
	description: "Zoom out to keep the whole photo.",
	confirmLabel: "Use photo",
	cancelLabel: "Skip",
	onCropped: vi.fn(),
	onSkip: vi.fn(),
};

afterEach(() => {
	cleanup();
});

describe("ImageCropDialogClientOnly", () => {
	it("renders nothing while no photo is waiting, on the server too", () => {
		expect(renderToString(<ImageCropDialogClientOnly source={null} {...BASE_PROPS} />)).toBe("");
	});

	it("loads the crop dialog once a photo is picked, with the same props", async () => {
		const source: ImageCropSource = {
			id: "pick-1",
			file: new File(["x"], "photo.png", { type: "image/png" }),
			image: { width: 800, height: 600, close: vi.fn() },
			previewUrl: "blob:photo",
		};
		render(<ImageCropDialogClientOnly source={source} {...BASE_PROPS} />);
		await waitFor(() => {
			expect(screen.getByText("Crop your photo: pick-1")).toBeDefined();
		});
	});
});
