// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { FILE_UPLOAD_EXAMPLES } from "@/components/component-gallery/examples/file-upload";
import { FileUpload1Example } from "@/components/component-gallery/examples/file-upload/file-upload-1";
import { FileUpload2Example } from "@/components/component-gallery/examples/file-upload/file-upload-2";
import { FileUpload5Example } from "@/components/component-gallery/examples/file-upload/file-upload-5";
import { BYTES_PER_MEGABYTE } from "@/components/component-gallery/examples/file-upload/file-upload-shared";

// ── jsdom has no object URLs ────────────────────────────────────────────────
// `useFileUpload` previews every picked file through `URL.createObjectURL` and
// revokes it on removal; jsdom implements neither, so give them inert stand-ins.

const PREVIEW_URL = "blob:gallery-test-preview";
const OBJECT_URL_METHODS: readonly ["createObjectURL", "revokeObjectURL"] = ["createObjectURL", "revokeObjectURL"];

function createPreviewUrl(): string {
	return PREVIEW_URL;
}

function revokePreviewUrl(): void {
	return;
}

beforeEach((): void => {
	Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: createPreviewUrl });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: revokePreviewUrl });
});

afterEach((): void => {
	for (const name of OBJECT_URL_METHODS) {
		Reflect.deleteProperty(URL, name);
	}
});

describeGalleryExamples("FileUpload", FILE_UPLOAD_EXAMPLES);

/** One byte past the avatar example's 2 MB limit. */
const OVERSIZED_AVATAR_BYTES = 2 * BYTES_PER_MEGABYTE + 1;
/** The simulated transfer's tick (300 ms) times the ticks to reach 100 % (10), with headroom. */
const SIMULATED_TRANSFER_DURATION_MS = 5000;

function imageFile(name: string, sizeBytes = 1): File {
	return new File([new Uint8Array(sizeBytes)], name, { type: "image/png" });
}

function pickFiles(input: HTMLElement, files: readonly File[]): void {
	fireEvent.change(input, { target: { files } });
}

describe("FileUpload interactions", (): void => {
	installGalleryExampleShims();

	it("shows a picked image's name and clears it again on Remove (c-file-upload-1)", (): void => {
		render(<FileUpload1Example />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("No image attached")).toBeDefined();

		pickFiles(screen.getByLabelText("Upload image file"), [imageFile("portrait.png")]);

		expect(screen.getByText("portrait.png")).toBeDefined();
		expect(screen.getByRole("button", { name: "Change image" })).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "Remove portrait.png" }));

		expect(screen.getByText("No image attached")).toBeDefined();
		expect(screen.queryByText("portrait.png")).toBeNull();
	});

	it("rejects an oversized avatar with the labelled size error (c-file-upload-2)", (): void => {
		render(<FileUpload2Example />, { wrapper: UiKitTestProviders });

		pickFiles(screen.getByLabelText("Avatar image file"), [imageFile("huge.png", OVERSIZED_AVATAR_BYTES)]);

		expect(screen.getByRole("alert").textContent).toContain('"huge.png" is larger than');
		expect(screen.getByText("Upload avatar")).toBeDefined();
	});

	it("lists a picked file with a progress bar until its simulated transfer completes (c-file-upload-5)", (): void => {
		vi.useFakeTimers();
		try {
			render(<FileUpload5Example />, { wrapper: UiKitTestProviders });

			pickFiles(screen.getByLabelText("Files"), [imageFile("notes.png")]);

			expect(screen.getByText("notes.png")).toBeDefined();
			expect(screen.getByRole("progressbar", { name: "notes.png progress" })).toBeDefined();

			act((): void => {
				vi.advanceTimersByTime(SIMULATED_TRANSFER_DURATION_MS);
			});

			expect(screen.queryByRole("progressbar", { name: "notes.png progress" })).toBeNull();
			expect(screen.getByText("notes.png")).toBeDefined();
		} finally {
			vi.useRealTimers();
		}
	});
});
