// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageIntake } from "@workspace/client/lib/storage/image-intake";
import type { RewardImageUploadInput, UploadedRewardImage } from "@/lib/rewards/use-upload-reward-image";

import { MerchantRewardImagesField, type SavedRewardImage } from "./merchant-reward-images-field";

const ORGANIZATION_ID = "0d5c7a3e-2b8f-4e61-9c4d-7a1b2c3d4e5f";
const SAVED: readonly SavedRewardImage[] = [
	{ fileId: "11111111-1111-4111-8111-111111111111", url: "https://cdn.example.com/a.webp", sources: [{ width: 640, url: "https://cdn.example.com/a-640.webp" }] },
	{ fileId: "22222222-2222-4222-8222-222222222222", url: "https://cdn.example.com/b.webp", sources: [] },
];

const { mutateAsync, takeRewardImage, exportPreparedImage } = vi.hoisted(() => ({
	mutateAsync: vi.fn<(input: RewardImageUploadInput) => Promise<UploadedRewardImage>>(),
	takeRewardImage: vi.fn<(file: File) => Promise<ImageIntake>>(),
	exportPreparedImage: vi.fn<() => Promise<File>>(),
}));

vi.mock("@/lib/rewards/use-upload-reward-image", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/rewards/use-upload-reward-image")>();
	return { ...actual, useUploadRewardImage: (): object => ({ mutateAsync }) };
});
vi.mock("@/lib/rewards/reward-image-intake", () => ({ takeRewardImage }));
vi.mock("@workspace/client/lib/storage/image-preparation", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@workspace/client/lib/storage/image-preparation")>();
	return { ...actual, exportPreparedImage };
});

/** Embla and Base UI observe sizes — jsdom implements neither. */
class NoopObserver {
	public observe(): void {
		return undefined;
	}
	public unobserve(): void {
		return undefined;
	}
	public disconnect(): void {
		return undefined;
	}
}

beforeAll((): void => {
	vi.stubGlobal("ResizeObserver", NoopObserver);
});

let objectUrlCount = 0;
beforeEach((): void => {
	objectUrlCount = 0;
	reportedImages = undefined;
	onImagesChange.mockReset();
	URL.createObjectURL = vi.fn((): string => {
		objectUrlCount += 1;
		return `blob:local-${String(objectUrlCount)}`;
	});
	URL.revokeObjectURL = vi.fn();
});

afterEach((): void => {
	cleanup();
	mutateAsync.mockReset();
	takeRewardImage.mockReset();
	exportPreparedImage.mockReset();
});

function photo(name: string): File {
	return new File([new Uint8Array(8)], name, { type: "image/jpeg" });
}

function prepared(file: File): ImageIntake {
	return { kind: "prepared", file: new File([new Uint8Array(8)], file.name.replace(/\.\w+$/u, ".webp"), { type: "image/webp" }) };
}

/** The images the field last reported, in full (the live preview reads the cover's URL from them). */
let reportedImages: readonly SavedRewardImage[] | undefined;
/** Hears the reported images' ids, in order — what the form saves. */
const onImagesChange = vi.fn<(fileIds: readonly string[]) => void>();

function handleImagesChange(images: readonly SavedRewardImage[]): void {
	reportedImages = images;
	onImagesChange(images.map((image) => image.fileId));
}

/** Renders the field; the returned mock hears the reported images' ids. */
function renderField(initialImages: readonly SavedRewardImage[] = []): typeof onImagesChange {
	render(
		<UiKitTestProviders>
			<MerchantRewardImagesField organizationId={ORGANIZATION_ID} initialImages={initialImages} onImagesChange={handleImagesChange} />
		</UiKitTestProviders>,
	);
	return onImagesChange;
}

function pick(...files: File[]): void {
	fireEvent.change(screen.getByLabelText("Photos"), { target: { files } });
}

function tiles(): HTMLElement[] {
	return [...document.querySelectorAll<HTMLElement>('[data-slot="reward-image-tile"]')];
}

function tileSources(): (string | null | undefined)[] {
	return tiles().map((tile) => tile.querySelector("img")?.getAttribute("src"));
}

describe("MerchantRewardImagesField", () => {
	it("shows the saved photos in order, the first marked as the cover, and how many more fit", () => {
		const onImagesChange = renderField(SAVED);

		expect(tileSources()).toEqual(["https://cdn.example.com/a.webp", "https://cdn.example.com/b.webp"]);
		expect(tiles().map((tile) => tile.querySelector("img")?.getAttribute("srcset") ?? null)).toEqual(["https://cdn.example.com/a-640.webp 640w", null]);
		const [first, second] = tiles();
		expect(first === undefined ? null : within(first).queryByText("Cover")).not.toBeNull();
		expect(second === undefined ? null : within(second).queryByText("Cover")).toBeNull();
		expect(screen.getByText("2 of 10 added")).toBeDefined();
		expect(onImagesChange).not.toHaveBeenCalled();
	});

	it("uploads every picked photo and saves the ready ones in order", async () => {
		takeRewardImage.mockImplementation((file: File) => Promise.resolve(prepared(file)));
		mutateAsync.mockImplementation(({ file }: RewardImageUploadInput) =>
			Promise.resolve({
				fileId: file.name === "one.webp" ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
				url: `https://cdn.example.com/${file.name}`,
			}),
		);
		const onImagesChange = renderField();

		pick(photo("one.jpg"), photo("two.jpg"));

		await waitFor((): void => {
			expect(onImagesChange).toHaveBeenLastCalledWith(["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]);
		});
		// The full images travel with the ids, so the editor's preview can draw the cover straight away.
		expect(reportedImages?.map((image) => image.url)).toEqual(["https://cdn.example.com/one.webp", "https://cdn.example.com/two.webp"]);
		expect(mutateAsync.mock.calls.map(([input]) => [input.organizationId, input.file.name])).toEqual([
			[ORGANIZATION_ID, "one.webp"],
			[ORGANIZATION_ID, "two.webp"],
		]);
		expect(tileSources()).toEqual(["https://cdn.example.com/one.webp", "https://cdn.example.com/two.webp"]);
	});

	it("explains a refused photo and uploads nothing for it", async () => {
		takeRewardImage.mockResolvedValue({ kind: "refused", fileName: "tiny.jpg", message: "Images must be at least 1920 × 1080 pixels so they stay sharp on every screen." });
		renderField();

		pick(photo("tiny.jpg"));

		expect(await screen.findByText("tiny.jpg: Images must be at least 1920 × 1080 pixels so they stay sharp on every screen.")).toBeDefined();
		expect(mutateAsync).not.toHaveBeenCalled();
	});

	it("takes only as many photos as still fit, and says so", async () => {
		takeRewardImage.mockImplementation((file: File) => Promise.resolve(prepared(file)));
		mutateAsync.mockReturnValue(new Promise<UploadedRewardImage>(() => undefined));
		const nine = Array.from({ length: 9 }, (_, index) => ({
			fileId: `00000000-0000-4000-8000-00000000000${String(index)}`,
			url: `https://cdn.example.com/${String(index)}.webp`,
			sources: [],
		}));
		renderField(nine);

		pick(photo("a.jpg"), photo("b.jpg"), photo("c.jpg"));

		expect(await screen.findByText("A reward can have up to 10 photos, so 2 of them were not added.")).toBeDefined();
		await waitFor((): void => {
			expect(takeRewardImage).toHaveBeenCalledTimes(1);
		});
		expect(document.querySelector('[data-slot="reward-images-dropzone"]')).toBeNull();
	});

	it("reorders and removes photos, saving the new order", () => {
		const onImagesChange = renderField(SAVED);

		fireEvent.click(screen.getByRole("button", { name: "Move photo 2 earlier" }));
		expect(onImagesChange).toHaveBeenLastCalledWith(["22222222-2222-4222-8222-222222222222", "11111111-1111-4111-8111-111111111111"]);
		// Only possible moves are offered: the cover cannot go earlier, the last photo cannot go later.
		expect(screen.queryByRole("button", { name: "Move photo 1 earlier" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Move photo 2 later" })).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" }));
		expect(onImagesChange).toHaveBeenLastCalledWith(["11111111-1111-4111-8111-111111111111"]);
	});

	it("asks for a crop when the photo is not 16:9 — skipping it uploads nothing, using it uploads the crop", async () => {
		// A 4:3 phone photo, read upright (ImageBitmap is only width, height and close).
		const image: ImageBitmap = { width: 4032, height: 3024, close: vi.fn<() => void>() };
		takeRewardImage.mockImplementation((file: File) => Promise.resolve({ kind: "needs_crop", source: file, image }));
		const cropped = new File([new Uint8Array(8)], "tall.webp", { type: "image/webp" });
		exportPreparedImage.mockResolvedValue(cropped);
		mutateAsync.mockResolvedValue({ fileId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", url: "https://cdn.example.com/tall.webp" });
		const onImagesChange = renderField();

		pick(photo("tall.jpg"), photo("wide.jpg"));
		expect(await screen.findByRole("dialog", { name: "Crop the photo" })).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Skip this photo" }));
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});
		expect(mutateAsync).not.toHaveBeenCalled();

		fireEvent.click(await screen.findByRole("button", { name: "Use photo" }));
		await waitFor((): void => {
			expect(onImagesChange).toHaveBeenLastCalledWith(["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]);
		});
		expect(mutateAsync).toHaveBeenCalledWith({ organizationId: ORGANIZATION_ID, file: cropped });
	});

	it("drops a photo whose upload failed and says why", async () => {
		takeRewardImage.mockImplementation((file: File) => Promise.resolve(prepared(file)));
		mutateAsync.mockRejectedValue(new Error("The image could not be checked."));
		const onImagesChange = renderField();

		pick(photo("broken.jpg"));

		expect(await screen.findByText("broken.webp: The image could not be checked.")).toBeDefined();
		expect(tiles()).toHaveLength(0);
		expect(onImagesChange).not.toHaveBeenCalled();
	});
});
