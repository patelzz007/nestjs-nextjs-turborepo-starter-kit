// ============================================
// use-comment-image-attach.ts - "Add a picture" for the comment boxes (ADR 052)
// ============================================
// Picks one photo from the library, holds its place in the comment with an
// "Uploading…" line, uploads it as a `GITHUB_COMMENT_IMAGE` (lib/file-upload.ts),
// has the API commit it to the pull request's repository (`attachPicture`,
// with an Idempotency-Key so a retry never commits it twice) and swaps the line
// for the picture's markdown — its repository address, which GitHub shows to
// whoever may read the repository. A refused or failed step takes the line out
// again and says why. One picture at a time.

import { FileProcessingError } from "@workspace/api-client";
import type { GithubPullRequestParams } from "@workspace/shared";
import { launchImageLibraryAsync } from "expo-image-picker";
import * as React from "react";

import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { FileUploadRejectedError, uploadLocalFile } from "../../lib/file-upload";
import { useIdempotencyKeys } from "../../lib/idempotency-keys";
import {
	imageMarkdown,
	pickedImageMimeType,
	pickedImageName,
	pickedImageProblem,
	uploadingPlaceholder,
	withLineAppended,
	withPlaceholderReplaced,
	type PickedImage,
} from "./comment-images";

/** JPEG quality the picker re-encodes a photo at: indistinguishable on a phone, a fraction of the size. */
const PICKED_PHOTO_QUALITY = 0.8;

/** Why an upload failed, in the writer's words. */
export function attachErrorMessage(caught: Error | null): string {
	if (caught instanceof FileProcessingError) {
		return caught.kind === "timeout" ? "The picture is still being checked. Try again in a moment." : "The picture was not accepted. Try a different one.";
	}
	if (caught instanceof FileUploadRejectedError) {
		return caught.message;
	}
	return errorMessageOf(caught);
}

export interface CommentImageAttach {
	/** Opens the photo library; the picked picture is uploaded and added to the comment. */
	readonly attach: () => void;
	readonly isUploading: boolean;
	/** Why the last picture was not added; cleared by the next try. */
	readonly error: string | null;
}

/** "Add a picture" for a comment on `pullRequest` whose text `setBody` updates. */
export function useCommentImageAttach(pullRequest: GithubPullRequestParams, setBody: React.Dispatch<React.SetStateAction<string>>): CommentImageAttach {
	const api = useApi();
	const attachPicture = api.githubPullRequests.attachPicture.useIdempotentMutation();
	const keys = useIdempotencyKeys();
	const me = api.auth.me.useQuery(undefined);
	const userId = me.data?.data.id;
	const [isUploading, setUploading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const upload = React.useCallback(async (): Promise<void> => {
		if (userId === undefined) {
			setError("Your account is still loading. Try again in a moment.");
			return;
		}
		const picked = await launchImageLibraryAsync({ mediaTypes: ["images"], quality: PICKED_PHOTO_QUALITY, exif: false });
		const [asset] = picked.canceled ? [] : picked.assets;
		if (asset === undefined) {
			return;
		}
		const image: PickedImage = { fileName: asset.fileName ?? null, mimeType: asset.mimeType ?? null, fileSize: asset.fileSize ?? null };
		const mimeType = pickedImageMimeType(image);
		const problem = pickedImageProblem(image);
		if (problem !== null || mimeType === null) {
			setError(problem);
			return;
		}
		const name = pickedImageName(image);
		const placeholder = uploadingPlaceholder(name);
		setUploading(true);
		setBody((body: string): string => withLineAppended(body, placeholder));
		try {
			const file = await uploadLocalFile(api, { category: "GITHUB_COMMENT_IMAGE", userId }, { uri: asset.uri, name, mimeType });
			const committed = await attachPicture.mutateAsync({ input: { ...pullRequest, fileId: file.id }, idempotencyKey: keys.keyFor(file.id) });
			keys.spend();
			const markdown = imageMarkdown(name, committed.data.url);
			setBody((body: string): string => withPlaceholderReplaced(body, placeholder, markdown));
		} catch (caught: unknown) {
			setBody((body: string): string => withPlaceholderReplaced(body, placeholder, ""));
			setError(attachErrorMessage(caught instanceof Error ? caught : null));
		} finally {
			setUploading(false);
		}
	}, [api, attachPicture, keys, pullRequest, setBody, userId]);

	const attach = React.useCallback((): void => {
		setError(null);
		upload().catch((caught: unknown): void => {
			setUploading(false);
			setError(attachErrorMessage(caught instanceof Error ? caught : null));
		});
	}, [upload]);

	return { attach, isUploading, error };
}
