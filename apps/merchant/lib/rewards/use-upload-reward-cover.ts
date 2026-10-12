"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/auth";
import { toDocumentMimeType, uploadFileDirect, waitForFileReady } from "@workspace/client/lib/storage/direct-upload";
import { assertImageFileAllowed, imageFileRules, type ImageFileRules } from "@workspace/client/lib/storage/image-file-rules";
import { FILE_CATEGORY_POLICIES, type FileCategoryPolicy } from "@workspace/shared";

/** The reward-cover upload policy (size + image types), from the shared contract the API enforces. */
export const REWARD_COVER_FILE_POLICY: FileCategoryPolicy = FILE_CATEGORY_POLICIES.REWARD_COVER;

/** The cover file input's `accept` and size limit. */
export const REWARD_COVER_FILE_RULES: ImageFileRules = imageFileRules(REWARD_COVER_FILE_POLICY);

/** A cover that finished uploading and passed the scan: what the reward form saves and previews. */
export interface UploadedRewardCover {
	readonly fileId: string;
	readonly publicUrl: string;
}

/** The scan accepted the file but it has no public copy — the cover cannot be shown, so it is not used. */
export class RewardCoverNotPublishedError extends Error {
	public constructor() {
		super("The image was accepted but could not be published. Try another image.");
		this.name = "RewardCoverNotPublishedError";
	}
}

export interface RewardCoverUploadInput {
	/** The organization the cover belongs to (only its reward managers may upload). */
	readonly organizationId: string;
	readonly file: File;
}

/**
 * Uploads a reward cover through the file pipeline: check the image →
 * upload ticket → direct upload to storage → complete → wait for the scan
 * verdict. The cover is not attached to anything yet: the reward names it in
 * `coverFileId` when it is saved, and the API re-checks it then.
 *
 * Errors: `ImageFileRejectedError` (bad file, nothing uploaded),
 * `DirectUploadError` (storage unreachable / rejected), `FileProcessingError`
 * (the scan refused it or timed out), {@link RewardCoverNotPublishedError}, or an `ApiError`.
 */
export function useUploadRewardCover(): UseMutationResult<UploadedRewardCover, Error, RewardCoverUploadInput> {
	const { api } = useAuth();
	return useMutation({
		mutationFn: async ({ organizationId, file }: RewardCoverUploadInput): Promise<UploadedRewardCover> => {
			assertImageFileAllowed(file, REWARD_COVER_FILE_POLICY);
			const uploaded = await uploadFileDirect(api, { category: "REWARD_COVER", organizationId, fileName: file.name, mimeType: toDocumentMimeType(file) }, file);
			const ready = await waitForFileReady(api, uploaded.fileId);
			const publicUrl = ready.file.publicUrl;
			if (publicUrl === null) {
				throw new RewardCoverNotPublishedError();
			}
			return { fileId: ready.file.id, publicUrl };
		},
	});
}
