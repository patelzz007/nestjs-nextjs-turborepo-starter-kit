// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { epochMs, type CompleteFileUploadResponse } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TestQueryClientProvider } from "@/test/query-client";

import { REWARD_IMAGE_FILE_RULES, REWARD_IMAGE_RULES, RewardImageNotPublishedError, useUploadRewardImage, type UploadedRewardImage } from "../use-upload-reward-image";

const TENANT_ID = "0d5c7a3e-2b8f-4e61-9c4d-7a1b2c3d4e5f";
const TENANT_SLUG = "jonker-street-kitchen";
const FILE_ID = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";
const PUBLIC_URL = `https://cdn.example.com/stores/${TENANT_ID}/reward-images/${FILE_ID}.webp`;
const API = { files: {} };

const { uploadTenantFileDirect, waitForFileReady } = vi.hoisted(() => ({
	uploadTenantFileDirect: vi.fn(),
	waitForFileReady: vi.fn<(api: object, fileId: string) => Promise<CompleteFileUploadResponse>>(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({ useAuth: (): object => ({ api: API }) }));
vi.mock("@workspace/client/lib/storage/direct-upload", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@workspace/client/lib/storage/direct-upload")>();
	return { ...actual, uploadTenantFileDirect, waitForFileReady };
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
	uploadTenantFileDirect.mockReset();
	waitForFileReady.mockReset();
});

describe("useUploadRewardImage", () => {
	it("uploads the image as the tenant's REWARD_IMAGE, waits for the checks, and returns the published image", async () => {
		uploadTenantFileDirect.mockResolvedValue({ fileId: FILE_ID });
		waitForFileReady.mockResolvedValue(readyFile(PUBLIC_URL));
		const { result } = renderHook(useUploadRewardImage, { wrapper: TestQueryClientProvider });
		const file = imageFile();

		let image: UploadedRewardImage | undefined;
		await act(async (): Promise<void> => {
			image = await result.current.mutateAsync({ tenantSlug: TENANT_SLUG, file });
		});

		expect(uploadTenantFileDirect).toHaveBeenCalledWith(API, TENANT_SLUG, { category: "REWARD_IMAGE", fileName: "kuih.webp", mimeType: "image/webp" }, file);
		expect(waitForFileReady).toHaveBeenCalledWith(API, FILE_ID);
		expect(image).toEqual({ fileId: FILE_ID, url: PUBLIC_URL });
	});

	it("rejects a file that is not an allowed image before uploading anything", async () => {
		const { result } = renderHook(useUploadRewardImage, { wrapper: TestQueryClientProvider });

		act((): void => {
			result.current.mutate({ tenantSlug: TENANT_SLUG, file: imageFile("application/pdf") });
		});

		await waitFor((): void => {
			expect(result.current.error?.name).toBe("ImageFileRejectedError");
		});
		expect(uploadTenantFileDirect).not.toHaveBeenCalled();
	});

	it("refuses an image that passed the checks but has no public copy", async () => {
		uploadTenantFileDirect.mockResolvedValue({ fileId: FILE_ID });
		waitForFileReady.mockResolvedValue(readyFile(null));
		const { result } = renderHook(useUploadRewardImage, { wrapper: TestQueryClientProvider });

		act((): void => {
			result.current.mutate({ tenantSlug: TENANT_SLUG, file: imageFile() });
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
