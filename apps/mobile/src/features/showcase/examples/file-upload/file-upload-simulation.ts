import type { FileUpload, UploadFile } from "@workspace/ui-native/lib/use-file-upload";
import * as React from "react";

/** How often the sample upload reports progress, in ms, and how far each report moves it. */
const TICK_MS = 300;
const STEP = 0.2;

/**
 * Stands in for a real upload in the examples: every new file is "sent" a
 * fifth at a time, then marked done — the calls an app makes from its upload
 * request's progress events instead.
 */
export function useSimulatedUploads(upload: FileUpload): void {
	const { files, setProgress, setStatus } = upload;
	React.useEffect((): (() => void) | undefined => {
		const sending = files.filter((file: UploadFile): boolean => file.status === "ready" || file.status === "uploading");
		if (sending.length === 0) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			for (const file of sending) {
				const next = (file.progress ?? 0) + STEP;
				if (next >= 1) {
					setStatus(file.id, "done");
				} else {
					setProgress(file.id, next);
				}
			}
		}, TICK_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [files, setProgress, setStatus]);
}
