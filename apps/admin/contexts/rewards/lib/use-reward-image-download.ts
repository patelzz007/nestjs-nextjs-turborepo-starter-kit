"use client";

import { apiDownloads, saveDownloadedFile } from "@workspace/client/lib/api/download";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { triggerBrowserDownload } from "@workspace/client/lib/storage/browser-download";
import * as React from "react";

import { toastMutationError, UNKNOWN_MUTATION_ERROR_MESSAGE } from "@/lib/api/mutation-error";

/**
 * Downloads a reward's images at full resolution: one image (`pendingFileId`
 * is the one being fetched), or all of them in one ZIP (`isArchivePending`).
 */
export interface RewardImageDownload {
	readonly download: (rewardId: string, fileId: string) => void;
	readonly pendingFileId: string | null;
	readonly downloadAll: (rewardId: string) => void;
	readonly isArchivePending: boolean;
}

/**
 * One image: a fresh signed URL per click — it expires, so it is never
 * prefetched or cached — saved under the original upload's name. All images:
 * the API streams one ZIP of the original uploads, saved under the name it
 * gives (`<reward>-photos.zip`). A failure is toasted.
 */
export function useRewardImageDownload(): RewardImageDownload {
	const { api } = useAuth();
	const [pendingFileId, setPendingFileId] = React.useState<string | null>(null);
	const [isArchivePending, setIsArchivePending] = React.useState(false);

	const download = React.useCallback(
		(rewardId: string, fileId: string): void => {
			setPendingFileId(fileId);
			void (async (): Promise<void> => {
				try {
					const response = await api.rewardsAdmin.downloadRewardImage.fetchOrThrow({ rewardId, fileId });
					triggerBrowserDownload(response.data.downloadUrl, response.data.fileName);
				} catch (error: unknown) {
					toastMutationError("Download failed", error instanceof Error ? error : new Error(UNKNOWN_MUTATION_ERROR_MESSAGE));
				} finally {
					setPendingFileId(null);
				}
			})();
		},
		[api],
	);

	const downloadAll = React.useCallback(
		(rewardId: string): void => {
			setIsArchivePending(true);
			void (async (): Promise<void> => {
				try {
					saveDownloadedFile(await api.download(apiDownloads.rewardsAdmin.rewardImagesArchive, { rewardId }));
				} catch (error: unknown) {
					toastMutationError("Download failed", error instanceof Error ? error : new Error(UNKNOWN_MUTATION_ERROR_MESSAGE));
				} finally {
					setIsArchivePending(false);
				}
			})();
		},
		[api],
	);

	return { download, pendingFileId, downloadAll, isArchivePending };
}
