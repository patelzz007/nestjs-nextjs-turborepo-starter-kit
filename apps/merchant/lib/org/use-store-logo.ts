"use client";

import { useMutation, useQueryClient, type QueryClient, type UseMutationResult } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/auth";
import { toDocumentMimeType, uploadFileDirect, waitForFileReady } from "@workspace/client/lib/storage/direct-upload";
import { assertImageFileAllowed, imageFileRules, requireImageRules, type ImageFileRules } from "@workspace/client/lib/storage/image-file-rules";
import { FILE_CATEGORY_POLICIES, type CompleteFileUploadResponse, type DeleteSuccessData, type Envelope, type FileCategoryPolicy, type ImageRules } from "@workspace/shared";

/** The store-logo upload policy (types, size, pixel rules), from the shared contract the API enforces. */
export const STORE_LOGO_FILE_POLICY: FileCategoryPolicy = FILE_CATEGORY_POLICIES.STORE_LOGO;

/** The logo picker's `accept` and size limit. */
export const STORE_LOGO_FILE_RULES: ImageFileRules = imageFileRules(STORE_LOGO_FILE_POLICY);

/** Square, at least 256 × 256 — any other image is cropped first; a wordmark zooms out to fit whole. */
export const STORE_LOGO_IMAGE_RULES: ImageRules = requireImageRules(STORE_LOGO_FILE_POLICY);

/** The limits shown under the logo controls — from the shared logo policy. */
export const STORE_LOGO_HINT = `A square image, at least ${String(STORE_LOGO_IMAGE_RULES.minWidth)} × ${String(STORE_LOGO_IMAGE_RULES.minHeight)} pixels — any other image is cropped first, and can be zoomed out to fit whole. JPEG, PNG, WebP or AVIF, up to ${String(STORE_LOGO_FILE_RULES.maxMebibytes)} MB.`;

export interface StoreLogoUploadInput {
	/** The organization the logo belongs to (only members who manage locations may change it). */
	readonly organizationId: string;
	/** The prepared, square logo (see `image-preparation`). */
	readonly file: File;
}

export interface UseStoreLogoOptions {
	/** The organization whose context shows the logo — reloaded after every change. */
	readonly orgSlug: string;
	readonly onSuccess: () => void;
	/**
	 * Every failure: `ImageFileRejectedError` (bad file, nothing uploaded),
	 * `DirectUploadError`, `FileProcessingError` (refused or timed out), or an `ApiError`.
	 */
	readonly onError: (error: Error) => void;
}

/** After the logo changed (bound or deleted): reload the organization context, which reports the live logo. */
async function refreshContextAfterLogoChange(queryClient: QueryClient, orgSlug: string): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: apiRouter.organizations.context.scopeKey({ orgSlug }) });
}

/**
 * Upload (or replace) the organization's store logo through the file pipeline:
 * check the file → upload ticket → direct upload → complete (the API checks
 * the pixels) → wait for the scan. The API binds the READY file as the
 * organization's `LOGO`, replacing the previous one.
 */
export function useUploadStoreLogo({ orgSlug, onSuccess, onError }: UseStoreLogoOptions): UseMutationResult<CompleteFileUploadResponse, Error, StoreLogoUploadInput> {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ organizationId, file }: StoreLogoUploadInput): Promise<CompleteFileUploadResponse> => {
			assertImageFileAllowed(file, STORE_LOGO_FILE_POLICY);
			const uploaded = await uploadFileDirect(
				api,
				{ category: "STORE_LOGO", organizationId, assetType: "LOGO", fileName: file.name, mimeType: toDocumentMimeType(file) },
				file,
			);
			return waitForFileReady(api, uploaded.fileId);
		},
		onSuccess: async (): Promise<void> => {
			await refreshContextAfterLogoChange(queryClient, orgSlug);
			onSuccess();
		},
		onError: (error: Error): void => {
			onError(error);
		},
	});
}

/** Remove the store logo: `DELETE /files/:fileId` (needs `merchant:manage_locations`; soft deletes the file and its binding, audited). */
export function useRemoveStoreLogo({ orgSlug, onSuccess, onError }: UseStoreLogoOptions): UseMutationResult<Envelope<DeleteSuccessData>, Error, { readonly fileId: string }> {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	return api.files.delete.useMutation({
		onSuccess: async (): Promise<void> => {
			await refreshContextAfterLogoChange(queryClient, orgSlug);
			onSuccess();
		},
		onError: (error: Error): void => {
			onError(error);
		},
	});
}
