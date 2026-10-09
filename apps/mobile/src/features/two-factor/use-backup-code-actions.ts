// Copy and share for a list of backup codes (expo-clipboard, React Native Share).

import * as Clipboard from "expo-clipboard";
import * as React from "react";
import { Share } from "react-native";

export interface BackupCodeActions {
	readonly copy: () => void;
	readonly share: () => void;
	/** "Copied" feedback for the last copy, for a status banner. */
	readonly copied: boolean;
}

export function useBackupCodeActions(codes: readonly string[]): BackupCodeActions {
	const [copied, setCopied] = React.useState(false);
	const text = codes.join("\n");
	const copy = React.useCallback((): void => {
		Clipboard.setStringAsync(text)
			.then((): void => {
				setCopied(true);
			})
			.catch((): void => {
				setCopied(false);
			});
	}, [text]);
	const share = React.useCallback((): void => {
		Share.share({ message: text }).catch((): void => {
			// The share sheet was dismissed or is unavailable; the codes are still on screen.
		});
	}, [text]);
	return { copy, share, copied };
}
