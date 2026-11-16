import * as Clipboard from "expo-clipboard";
import * as React from "react";

/** How long the copy button shows its check after copying, in ms (the web code block's feedback). */
export const COPY_FEEDBACK_MS = 2000;

export interface CopyState {
	readonly copied: boolean;
	readonly copy: () => void;
}

/** Copies `text` to the clipboard; `copied` is `true` for a moment after it succeeds. */
export function useCopyText(text: string): CopyState {
	const [copied, setCopied] = React.useState<boolean>(false);
	React.useEffect((): (() => void) | undefined => {
		if (!copied) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			setCopied(false);
		}, COPY_FEEDBACK_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [copied]);
	const copy = React.useCallback((): void => {
		Clipboard.setStringAsync(text)
			.then((): void => {
				setCopied(true);
			})
			.catch((): void => {
				setCopied(false);
			});
	}, [text]);
	return { copied, copy };
}
