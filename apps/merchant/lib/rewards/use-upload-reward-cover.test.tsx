// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { epochMs, type CompleteFileUploadResponse } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TestQueryClientProvider } from "@/test/query-client";

import { REWARD_COVER_FILE_RULES, RewardCoverNotPublishedError, useUploadRewardCover, type UploadedRewardCover } from "./use-upload-reward-cover";

const ORGANIZATION_ID = "0d5c7a3e-2b8f-4e61-9c4d-7a1b2c3d4e5f";
const FILE_ID = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";
const PUBLIC_URL = `https://cdn.example.com/stores/${ORGANIZATION_ID}/reward-covers/${FILE_ID}.webp`;
const API = { files: {} };

const { uploadFileDirect, waitForFileReady } = vi.hoisted(() => ({
	uploadFileDirect: vi.fn(),
	waitForFileReady: vi.fn<(api: object, fileId: string) => Promise<CompleteFileUploadResponse>>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({ useAuth: (): object => ({ api: API }) }));
vi.mock("@workspace/client/lib/storage/direct-upload", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@workspace/client/lib/storage/direct-upload")>();
	return { ...actual, uploadFileDirect, waitForFileReady };
});

function readyFile(publicUrl: string | null): CompleteFileUploadResponse {
	return {
		file: {
			id: FILE_ID,
			category: "REWARD_COVER",
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

function coverFile(type = "image/webp", sizeBytes = 2048): File {
	return new File([new Uint8Array(sizeBytes)], "kuih.webp", { type });
}

afterEach((): void => {
	cleanup();
	uploadFileDirect.mockReset();
	waitForFileReady.mockReset();
});

describe("useUploadRewardCover", () => {
	it("uploads the image as the organization's REWARD_COVER, waits for the scan, and returns the published cover", async () => {
		uploadFileDirect.mockResolvedValue({ fileId: FILE_ID });
		waitForFileReady.mockResolvedValue(readyFile(PUBLIC_URL));
		const { result } = renderHook(useUploadRewardCover, { wrapper: TestQueryClientProvider });
		const file = coverFile();

		let cover: UploadedRewardCover | undefined;
		await act(async (): Promise<void> => {
			cover = await result.current.mutateAsync({ organizationId: ORGANIZATION_ID, file });
		});

		expect(uploadFileDirect).toHaveBeenCalledWith(API, { category: "REWARD_COVER", organizationId: ORGANIZATION_ID, fileName: "kuih.webp", mimeType: "image/webp" }, file);
		expect(waitForFileReady).toHaveBeenCalledWith(API, FILE_ID);
		expect(cover).toEqual({ fileId: FILE_ID, publicUrl: PUBLIC_URL });
	});

	it("rejects a file that is not an allowed image before uploading anything", async () => {
		const { result } = renderHook(useUploadRewardCover, { wrapper: TestQueryClientProvider });

		act((): void => {
			result.current.mutate({ organizationId: ORGANIZATION_ID, file: coverFile("application/pdf") });
		});

		await waitFor((): void => {
			expect(result.current.error?.name).toBe("ImageFileRejectedError");
		});
		expect(uploadFileDirect).not.toHaveBeenCalled();
	});

	it("refuses a cover that passed the scan but has no public copy", async () => {
		uploadFileDirect.mockResolvedValue({ fileId: FILE_ID });
		waitForFileReady.mockResolvedValue(readyFile(null));
		const { result } = renderHook(useUploadRewardCover, { wrapper: TestQueryClientProvider });

		act((): void => {
			result.current.mutate({ organizationId: ORGANIZATION_ID, file: coverFile() });
		});

		await waitFor((): void => {
			expect(result.current.error).toBeInstanceOf(RewardCoverNotPublishedError);
		});
	});

	it("takes the file input's limits from the shared reward-cover policy", () => {
		expect(REWARD_COVER_FILE_RULES).toEqual({ accept: "image/jpeg,image/png,image/webp,image/avif", maxMebibytes: 10 });
	});
});
