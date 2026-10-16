import { FILE_CATEGORY_POLICIES, type ImageRules } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { takeImage } from "./image-intake";

const { readUprightImage, exportPreparedImage } = vi.hoisted(() => ({
	readUprightImage: vi.fn<(file: Blob) => Promise<ImageBitmap>>(),
	exportPreparedImage: vi.fn<(image: ImageBitmap, area: object, rules: object, fileName: string) => Promise<File>>(),
}));

vi.mock("./image-preparation", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./image-preparation")>();
	return { ...actual, readUprightImage, exportPreparedImage };
});

function rulesOf(category: "REWARD_IMAGE" | "USER_AVATAR"): ImageRules {
	const rules = FILE_CATEGORY_POLICIES[category].imageRules;
	if (rules === undefined) {
		throw new Error(`${category} must declare image rules`);
	}
	return rules;
}

function photo(): File {
	return new File([new Uint8Array(8)], "kuih.jpg", { type: "image/jpeg" });
}

interface FakeBitmap {
	readonly image: ImageBitmap;
	/** The bitmap's `close` — asserted on to prove the photo's memory is released. */
	readonly close: ReturnType<typeof vi.fn<() => void>>;
}

function bitmap(width: number, height: number): FakeBitmap {
	const close = vi.fn<() => void>();
	return { image: { width, height, close }, close };
}

afterEach((): void => {
	readUprightImage.mockReset();
	exportPreparedImage.mockReset();
});

describe("takeImage", () => {
	it("refuses a photo too small for the minimum even when all of it shows, in the API's words, and releases it", async () => {
		const { image, close } = bitmap(800, 1000);
		readUprightImage.mockResolvedValue(image);

		await expect(takeImage(photo(), rulesOf("REWARD_IMAGE"))).resolves.toEqual({
			kind: "refused",
			fileName: "kuih.jpg",
			message: "Images must be at least 1920 × 1080 pixels so they stay sharp on every screen.",
		});
		expect(close).toHaveBeenCalled();
	});

	it("prepares a photo that already has the shape at once, scaling the whole frame", async () => {
		const { image, close } = bitmap(5760, 3240);
		const prepared = new File([new Uint8Array(8)], "kuih.webp", { type: "image/webp" });
		readUprightImage.mockResolvedValue(image);
		exportPreparedImage.mockResolvedValue(prepared);

		await expect(takeImage(photo(), rulesOf("REWARD_IMAGE"))).resolves.toEqual({ kind: "prepared", file: prepared });
		expect(exportPreparedImage).toHaveBeenCalledWith(image, { x: 0, y: 0, width: 5760, height: 3240 }, expect.objectContaining({ minWidth: 1920 }), "kuih.jpg");
		expect(close).toHaveBeenCalled();
	});

	it("asks for a crop when a photo has another shape, keeping it open for the cropper", async () => {
		const { image, close } = bitmap(4032, 3024);
		readUprightImage.mockResolvedValue(image);
		const file = photo();

		await expect(takeImage(file, rulesOf("USER_AVATAR"))).resolves.toEqual({ kind: "needs_crop", source: file, image });
		expect(close).not.toHaveBeenCalled();
	});

	it("asks for a crop when a photo is too small to fill the frame but can show whole inside it", async () => {
		const { image } = bitmap(1600, 1200);
		readUprightImage.mockResolvedValue(image);
		const file = photo();

		await expect(takeImage(file, rulesOf("REWARD_IMAGE"))).resolves.toEqual({ kind: "needs_crop", source: file, image });
	});

	it("refuses a file the browser cannot decode", async () => {
		readUprightImage.mockRejectedValue(new Error("decode failed"));

		await expect(takeImage(photo(), rulesOf("USER_AVATAR"))).resolves.toEqual({ kind: "refused", fileName: "kuih.jpg", message: "This file could not be read as an image." });
	});
});
