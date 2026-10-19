// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { epochMs, type CompleteFileUploadResponse } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TestQueryClientProvider } from "@/test/query-client";

import { REWARD_IMAGE_FILE_RULES, REWARD_IMAGE_RULES, RewardImageNotPublishedError, useUploadRewardImage, type UploadedRewardImage } from "../use-upload-reward-image";

const ORGANIZATION_ID = "0d5c7a3e-2b8f-4e61-9c4d-7a1b2c3d4e5f";
const FILE_ID = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";
const PUBLIC_URL = `https://cdn.example.com/stores/${ORGANIZATION_ID}/reward-images/${FILE_ID}.webp`;
const API = { files: {} };

const { uploadFileDirect, waitForFileReady } = vi.hoisted(() => ({
	uploadFileDirect: vi.fn(),
	waitForFileReady: vi.fn<(api: object, fileId: string) => Promise<CompleteFileUploadResponse>>(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({ useAuth: (): object => ({ api: API }) }));
vi.mock("@workspace/client/lib/storage/direct-upload", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@workspace/client/lib/storage/direct-upload")>();
	return { ...actual, uploadFileDirect, waitForFileReady };
});

function readyFile(publicUrl: string | null): CompleteFileUploadResponse {
	return {
		file: {
			id: FILE_ID,
			category: "REWARD_IMAGE",
			visibility: "PUBLIC",
			originalName: "kuih.webp",
			mimeType: "image/webp",
			sizeBytes: 2048,
			status: "READY",
			scanStatus: "NOT_SCANNED",
			publicUrl,
			uploadedAt: epochMs(1_794_614_400_000),
		},
	};
}

function imageFile(type = "image/webp", sizeBytes = 2048): File {
	return new File([new Uint8Array(sizeBytes)], "kuih.webp", { type });
}

afterEach((): void => {
	cleanup();
	uploadFileDirect.mockReset();
	waitForFileReady.mockReset();
});

describe("useUploadRewardImage", () => {
	it("uploads the image as the organization's REWARD_IMAGE, waits for the checks, and returns the published image", async () => {
		uploadFileDirect.mockResolvedValue({ fileId: FILE_ID });
		waitForFileReady.mockResolvedValue(readyFile(PUBLIC_URL));
		const { result } = renderHook(useUploadRewardImage, { wrapper: TestQueryClientProvider });
		const file = imageFile();

		let image: UploadedRewardImage | undefined;
		await act(async (): Promise<void> => {
			image = await result.current.mutateAsync({ organizationId: ORGANIZATION_ID, file });
		});

		expect(uploadFileDirect).toHaveBeenCalledWith(API, { category: "REWARD_IMAGE", organizationId: ORGANIZATION_ID, fileName: "kuih.webp", mimeType: "image/webp" }, file);
		expect(waitForFileReady).toHaveBeenCalledWith(API, FILE_ID);
		expect(image).toEqual({ fileId: FILE_ID, url: PUBLIC_URL });
	});

	it("rejects a file that is not an allowed image before uploading anything", async () => {
		const { result } = renderHook(useUploadRewardImage, { wrapper: TestQueryClientProvider });

		act((): void => {
			result.current.mutate({ organizationId: ORGANIZATION_ID, file: imageFile("application/pdf") });
		});

		await waitFor((): void => {
			expect(result.current.error?.name).toBe("ImageFileRejectedError");
		});
		expect(uploadFileDirect).not.toHaveBeenCalled();
	});

	it("refuses an image that passed the checks but has no public copy", async () => {
		uploadFileDirect.mockResolvedValue({ fileId: FILE_ID });
		waitForFileReady.mockResolvedValue(readyFile(null));
		const { result } = renderHook(useUploadRewardImage, { wrapper: TestQueryClientProvider });

		act((): void => {
			result.current.mutate({ organizationId: ORGANIZATION_ID, file: imageFile() });
		});

		await waitFor((): void => {
			expect(result.current.error).toBeInstanceOf(RewardImageNotPublishedError);
		});
	});

	it("takes the picker's limits and the pixel rules from the shared reward-image policy", () => {
		expect(REWARD_IMAGE_FILE_RULES).toEqual({ accept: "image/jpeg,image/png,image/webp,image/avif", maxMebibytes: 10 });
		expect(REWARD_IMAGE_RULES).toMatchObject({ aspectWidth: 16, aspectHeight: 9, minWidth: 1920, minHeight: 1080 });
	});
});
