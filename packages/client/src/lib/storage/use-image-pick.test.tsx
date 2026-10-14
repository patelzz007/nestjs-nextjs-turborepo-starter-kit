// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { FILE_CATEGORY_POLICIES, type ImageRules } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageIntake } from "./image-intake";
import { useImagePick } from "./use-image-pick";

const { takeImage } = vi.hoisted(() => ({ takeImage: vi.fn<(file: File, rules: ImageRules) => Promise<ImageIntake>>() }));

vi.mock("./image-intake", () => ({ takeImage }));

function avatarRules(): ImageRules {
	const rules = FILE_CATEGORY_POLICIES.USER_AVATAR.imageRules;
	if (rules === undefined) {
		throw new Error("USER_AVATAR must declare image rules");
	}
	return rules;
}

const PHOTO = new File([new Uint8Array(8)], "me.jpg", { type: "image/jpeg" });

interface Callbacks {
	readonly onPrepared: ReturnType<typeof vi.fn<(file: File) => void>>;
	readonly onRefused: ReturnType<typeof vi.fn<(message: string) => void>>;
}

function callbacks(): Callbacks {
	return { onPrepared: vi.fn<(file: File) => void>(), onRefused: vi.fn<(message: string) => void>() };
}

const revokeObjectURL = vi.fn<(url: string) => void>();

beforeEach((): void => {
	URL.createObjectURL = vi.fn((): string => "blob:preview");
	revokeObjectURL.mockReset();
	URL.revokeObjectURL = revokeObjectURL;
});

afterEach((): void => {
	takeImage.mockReset();
});

describe("useImagePick", () => {
	it("hands a photo that already has the shape straight on", async () => {
		const prepared = new File([new Uint8Array(4)], "me.webp", { type: "image/webp" });
		takeImage.mockResolvedValue({ kind: "prepared", file: prepared });
		const { onPrepared, onRefused } = callbacks();
		const { result } = renderHook(() => useImagePick({ rules: avatarRules(), onPrepared, onRefused }));

		act((): void => {
			result.current.pick(PHOTO);
		});

		await waitFor((): void => {
			expect(onPrepared).toHaveBeenCalledWith(prepared);
		});
		expect(takeImage).toHaveBeenCalledWith(PHOTO, avatarRules());
		expect(result.current.cropSource).toBeNull();
	});

	it("passes on why a photo cannot be used", async () => {
		takeImage.mockResolvedValue({ kind: "refused", fileName: "me.jpg", message: "Images must be at least 256 × 256 pixels so they stay sharp on every screen." });
		const { onPrepared, onRefused } = callbacks();
		const { result } = renderHook(() => useImagePick({ rules: avatarRules(), onPrepared, onRefused }));

		act((): void => {
			result.current.pick(PHOTO);
		});

		await waitFor((): void => {
			expect(onRefused).toHaveBeenCalledWith("Images must be at least 256 × 256 pixels so they stay sharp on every screen.");
		});
		expect(onPrepared).not.toHaveBeenCalled();
	});

	it("holds a photo of another shape for the cropper, then hands on the crop and releases the photo", async () => {
		const close = vi.fn();
		takeImage.mockResolvedValue({ kind: "needs_crop", source: PHOTO, image: { width: 1200, height: 800, close } });
		const { onPrepared, onRefused } = callbacks();
		const { result } = renderHook(() => useImagePick({ rules: avatarRules(), onPrepared, onRefused }));

		act((): void => {
			result.current.pick(PHOTO);
		});
		await waitFor((): void => {
			expect(result.current.cropSource).toMatchObject({ file: PHOTO, previewUrl: "blob:preview" });
		});

		const cropped = new File([new Uint8Array(4)], "me.webp", { type: "image/webp" });
		act((): void => {
			result.current.handleCropped(cropped);
		});

		expect(onPrepared).toHaveBeenCalledWith(cropped);
		expect(result.current.cropSource).toBeNull();
		expect(close).toHaveBeenCalled();
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview");
	});

	it("releases a skipped photo, and one still in the cropper when the screen goes away", async () => {
		const close = vi.fn();
		takeImage.mockResolvedValue({ kind: "needs_crop", source: PHOTO, image: { width: 1200, height: 800, close } });
		const { onPrepared, onRefused } = callbacks();
		const { result, unmount } = renderHook(() => useImagePick({ rules: avatarRules(), onPrepared, onRefused }));

		act((): void => {
			result.current.pick(PHOTO);
		});
		await waitFor((): void => {
			expect(result.current.cropSource).not.toBeNull();
		});
		act((): void => {
			result.current.handleSkip();
		});
		expect(close).toHaveBeenCalledTimes(1);
		expect(onPrepared).not.toHaveBeenCalled();

		act((): void => {
			result.current.pick(PHOTO);
		});
		await waitFor((): void => {
			expect(result.current.cropSource).not.toBeNull();
		});
		unmount();
		expect(close).toHaveBeenCalledTimes(2);
	});
});
