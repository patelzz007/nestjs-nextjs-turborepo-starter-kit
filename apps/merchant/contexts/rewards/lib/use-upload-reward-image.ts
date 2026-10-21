"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { toDocumentMimeType, uploadTenantFileDirect, waitForFileReady } from "@workspace/client/lib/storage/direct-upload";
import { assertImageFileAllowed, imageFileRules, requireImageRules, type ImageFileRules } from "@workspace/client/lib/storage/image-file-rules";
import { FILE_CATEGORY_POLICIES, type FileCategoryPolicy, type ImageRules } from "@workspace/shared";

/** The reward-image upload policy (types, size, pixel rules), from the shared contract the API enforces. */
export const REWARD_IMAGE_FILE_POLICY: FileCategoryPolicy = FILE_CATEGORY_POLICIES.REWARD_IMAGE;

/** The image picker's `accept` and size limit. */
export const REWARD_IMAGE_FILE_RULES: ImageFileRules = imageFileRules(REWARD_IMAGE_FILE_POLICY);

/** 16:9, at least 1920 × 1080 — every reward image is cropped to the ratio and kept at its own size, at most 4K, before it is uploaded. */
export const REWARD_IMAGE_RULES: ImageRules = requireImageRules(REWARD_IMAGE_FILE_POLICY);

/** An image that finished uploading and passed the checks: what the reward form saves and previews. */
export interface UploadedRewardImage {
	readonly fileId: string;
	readonly url: string;
}

/** The checks accepted the file but it has no public copy — it cannot be shown, so it is not used. */
export class RewardImageNotPublishedError extends Error {
	public constructor() {
		super("The image was accepted but could not be published. Try another image.");
		this.name = "RewardImageNotPublishedError";
	}
}

export interface RewardImageUploadInput {
	/** The tenant the image belongs to (only its reward managers may upload); its route names it, never the body. */
	readonly tenantSlug: string;
	/** The prepared image (cropped to 16:9, Full HD to 4K — see `image-preparation`). */
	readonly file: File;
}

/**
 * Uploads one reward image through the file pipeline: check the file → upload
 * ticket → direct upload to storage → complete (the API checks the pixels) →
 * wait for the scan and renditions. The image is not attached to anything
 * yet: the reward names it in `imageFileIds` when it is saved, and the API
 * re-checks it then. Use `mutateAsync` — several images upload at once.
 *
 * Errors: `ImageFileRejectedError` (bad file, nothing uploaded),
 * `DirectUploadError`, `FileProcessingError` (refused or timed out),
 * {@link RewardImageNotPublishedError}, or an `ApiError` (e.g. `FILE_IMAGE_DIMENSIONS_INVALID`).
 */
export function useUploadRewardImage(): UseMutationResult<UploadedRewardImage, Error, RewardImageUploadInput> {
	const { api } = useAuth();
	return useMutation({
		mutationFn: async ({ tenantSlug, file }: RewardImageUploadInput): Promise<UploadedRewardImage> => {
			assertImageFileAllowed(file, REWARD_IMAGE_FILE_POLICY);
			const uploaded = await uploadTenantFileDirect(api, tenantSlug, { category: "REWARD_IMAGE", fileName: file.name, mimeType: toDocumentMimeType(file) }, file);
			const ready = await waitForFileReady(api, uploaded.fileId);
			const url = ready.file.publicUrl;
			if (url === null) {
				throw new RewardImageNotPublishedError();
			}
			return { fileId: ready.file.id, url };
		},
	});
}
