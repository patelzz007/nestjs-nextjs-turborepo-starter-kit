"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { triggerBrowserDownload } from "@workspace/client/lib/storage/browser-download";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";

/** Downloading one attachment: a fresh short-lived link per click (never cached), then the browser saves it. */
export function useKanbanAttachmentDownload(taskId: string, attachmentId: string): { readonly isDownloading: boolean; readonly download: () => void } {
	const { api } = useAuth();
	const [isDownloading, setIsDownloading] = React.useState(false);
	const download = React.useCallback((): void => {
		setIsDownloading(true);
		api.kanban.attachmentDownload
			.fetchOrThrow({ taskId, attachmentId })
			.then((response): void => {
				triggerBrowserDownload(response.data.downloadUrl, response.data.fileName);
			})
			.catch((error: unknown): void => {
				toastMutationError("Could not download the file", error instanceof Error ? error : new Error("Download failed"));
			})
			.finally((): void => {
				setIsDownloading(false);
			});
	}, [api.kanban.attachmentDownload, attachmentId, taskId]);
	return { isDownloading, download };
}
