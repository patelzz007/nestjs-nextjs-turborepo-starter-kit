// Ported from ReUI (`use-copy-to-clipboard`): writes text to the clipboard
// and flags `isCopied` for a moment, for "Copied!" feedback. Same name,
// options and return shape as ReUI, with these deliberate deviations:
// - A failed write (denied permission, insecure origin, lost focus) is
//   reported through `onError` instead of `console.error`, and never becomes
//   an unhandled rejection.
// - A missing clipboard (SSR, insecure context, test DOM) is a no-op, checked
//   with the shared runtime helper rather than `typeof window`.
// - The reset timer restarts on every copy and is cleared on unmount.
"use client";

import { hasGlobalValue } from "@workspace/shared";
import * as React from "react";

/** How long `isCopied` stays true after a copy, by default. */
const DEFAULT_COPIED_RESET_MS = 2000;

/** `timeout` value that keeps `isCopied` true until the next copy. */
const NEVER_RESET = 0;

export interface UseCopyToClipboardOptions {
	/** Milliseconds `isCopied` stays true; `0` keeps it set. Default 2000. */
	readonly timeout?: number | undefined;
	/** After a successful write. */
	readonly onCopy?: (() => void) | undefined;
	/** After a failed write. */
	readonly onError?: ((error: Error) => void) | undefined;
}

export interface UseCopyToClipboardResult {
	readonly isCopied: boolean;
	/** Copies `value` (an empty string is ignored). */
	readonly copyToClipboard: (value: string) => void;
}

export function useCopyToClipboard({ timeout = DEFAULT_COPIED_RESET_MS, onCopy, onError }: UseCopyToClipboardOptions = {}): UseCopyToClipboardResult {
	const [isCopied, setIsCopied] = React.useState(false);
	const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearResetTimer = React.useCallback((): void => {
		if (resetTimer.current !== null) {
			clearTimeout(resetTimer.current);
			resetTimer.current = null;
		}
	}, []);

	React.useEffect((): (() => void) => clearResetTimer, [clearResetTimer]);

	const copyToClipboard = React.useCallback(
		(value: string): void => {
			if (value === "") {
				return;
			}
			/* Widened on purpose: the DOM typings promise a clipboard, but insecure origins and non-browser DOMs have none. */
			const clipboard: Clipboard | undefined = hasGlobalValue("navigator") ? navigator.clipboard : undefined;
			if (clipboard === undefined) {
				return;
			}
			/* Only the write's own rejection is a failed copy — never an error thrown by `onCopy`. */
			const written: Promise<boolean> = clipboard
				.writeText(value)
				.then((): boolean => true)
				.catch((error: unknown): boolean => {
					onError?.(error instanceof Error ? error : new Error("Clipboard write failed", { cause: error }));
					return false;
				});
			void written.then((isWritten: boolean): void => {
				if (!isWritten) {
					return;
				}
				clearResetTimer();
				setIsCopied(true);
				onCopy?.();
				if (timeout !== NEVER_RESET) {
					resetTimer.current = setTimeout((): void => {
						resetTimer.current = null;
						setIsCopied(false);
					}, timeout);
				}
			});
		},
		[clearResetTimer, onCopy, onError, timeout],
	);

	return { isCopied, copyToClipboard };
}
