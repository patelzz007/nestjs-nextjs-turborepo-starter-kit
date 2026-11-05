"use client";

import { FILE_CATEGORY_POLICIES, type FileCategoryPolicy } from "@workspace/shared";
import type { UploadedPicture } from "@workspace/ui/components/rich-text-editor";
import * as React from "react";

import { useAuth } from "../../contexts/identity";
import { toDocumentMimeType, uploadFileDirect, uploadTenantFileDirect, waitForFileReady } from "../../storage/direct-upload";
import { assertImageFileAllowed, imageFileRules } from "../../storage/image-file-rules";
import type { BroadcastPictureUpload } from "./broadcast-body-editor";

/** Whose broadcast the picture is for: a store's (its file) or the platform's (the staff member's upload). */
export type BroadcastPictureTarget = { readonly kind: "tenant"; readonly tenantSlug: string } | { readonly kind: "platform" };

/** The checks accepted the picture but it has no public copy: an email couldn't show it, so it isn't used. */
export class BroadcastPictureNotPublishedError extends Error {
	public constructor() {
		super("The picture was accepted but could not be published. Try another one.");
		this.name = "BroadcastPictureNotPublishedError";
	}
}

/** A picker and upload over one category, with the shared checks and the scan wait. */
function pictureUpload(
	api: ReturnType<typeof useAuth>["api"],
	policy: FileCategoryPolicy,
	send: (file: File) => Promise<{ readonly fileId: string }>,
): BroadcastPictureUpload {
	const upload = async (file: File): Promise<UploadedPicture> => {
		assertImageFileAllowed(file, policy);
		const uploaded = await send(file);
		const ready = await waitForFileReady(api, uploaded.fileId);
		if (ready.file.publicUrl === null) {
			throw new BroadcastPictureNotPublishedError();
		}
		return { fileId: ready.file.id, src: ready.file.publicUrl };
	};
	return { upload, accept: imageFileRules(policy).accept };
}

/**
 * The broadcast composer's picture upload (enhancement 5.4), through the file pipeline: check the file → upload
 * ticket → direct upload → complete (the API checks it) → wait for the scan. The picture is named by the body
 * when the broadcast is saved, and the API checks it again then. Errors surface in the control. A platform
 * picture is the signed-in staff member's own upload, so there is none before the session is known.
 */
export function useBroadcastPictureUpload(target: BroadcastPictureTarget): BroadcastPictureUpload | undefined {
	const { api, user } = useAuth();
	const userId = user?.id ?? null;
	const tenantSlug = target.kind === "tenant" ? target.tenantSlug : null;
	return React.useMemo((): BroadcastPictureUpload | undefined => {
		if (tenantSlug !== null) {
			return pictureUpload(api, FILE_CATEGORY_POLICIES.BROADCAST_IMAGE, (file) =>
				uploadTenantFileDirect(api, tenantSlug, { category: "BROADCAST_IMAGE", fileName: file.name, mimeType: toDocumentMimeType(file) }, file),
			);
		}
		if (userId === null) {
			return undefined;
		}
		return pictureUpload(api, FILE_CATEGORY_POLICIES.PLATFORM_BROADCAST_IMAGE, (file) =>
			uploadFileDirect(api, { category: "PLATFORM_BROADCAST_IMAGE", userId, fileName: file.name, mimeType: toDocumentMimeType(file) }, file),
		);
	}, [api, tenantSlug, userId]);
}
