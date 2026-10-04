"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { CompleteFileUploadResponse, DeleteSuccessData, Envelope } from "@workspace/shared";

import { toDocumentMimeType, uploadFileDirect, waitForFileReady } from "../../storage/direct-upload";
import { useAuth } from "../index";
import { assertAvatarFileAllowed, refreshProfileAfterAvatarChange } from "./profile-avatar";

export interface AvatarUploadInput {
	/** The signed-in user's id — the API only accepts an avatar for the caller's own account. */
	readonly userId: string;
	readonly file: File;
}

export interface UseProfileAvatarOptions {
	readonly onSuccess?: () => void;
	/**
	 * Every failure: `AvatarFileRejectedError` (bad file, nothing uploaded),
	 * `DirectUploadError` (storage unreachable / CORS / rejected),
	 * `FileProcessingError` (scan refused it or timed out), or an `ApiError`.
	 */
	readonly onError: (error: Error) => void;
}

/**
 * Upload (or replace) the own avatar through the file pipeline: validate →
 * upload ticket → direct upload → complete → wait for the scan verdict. The
 * scanned file is bound to the user server-side; the profile is then reloaded.
 */
export function useUploadProfileAvatar(options: UseProfileAvatarOptions): UseMutationResult<CompleteFileUploadResponse, Error, AvatarUploadInput> {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ userId, file }: AvatarUploadInput): Promise<CompleteFileUploadResponse> => {
			assertAvatarFileAllowed(file);
			const uploaded = await uploadFileDirect(api, { category: "USER_AVATAR", userId, fileName: file.name, mimeType: toDocumentMimeType(file) }, file);
			return waitForFileReady(api, uploaded.fileId);
		},
		onSuccess: async (): Promise<void> => {
			await refreshProfileAfterAvatarChange(queryClient);
			options.onSuccess?.();
		},
		onError: options.onError,
	});
}

/** Remove the own avatar: `DELETE /files/:fileId` (owner-only, soft delete of the file and its binding, audited). */
export function useRemoveProfileAvatar(options: UseProfileAvatarOptions): UseMutationResult<Envelope<DeleteSuccessData>, Error, { readonly fileId: string }> {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	return api.files.delete.useMutation({
		onSuccess: async (): Promise<void> => {
			await refreshProfileAfterAvatarChange(queryClient);
			options.onSuccess?.();
		},
		onError: options.onError,
	});
}
