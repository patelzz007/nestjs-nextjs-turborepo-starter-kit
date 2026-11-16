import CheckIcon from "lucide-react-native/icons/check";
import CopyIcon from "lucide-react-native/icons/copy";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";
import * as Clipboard from "expo-clipboard";

/** How long the button shows its check, in ms. */
const COPIED_FOR_MS = 1500;

export function Button42Example(): React.JSX.Element {
	const [copied, setCopied] = React.useState<boolean>(false);
	React.useEffect((): (() => void) | undefined => {
		if (!copied) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			setCopied(false);
		}, COPIED_FOR_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [copied]);
	const copy = React.useCallback((): void => {
		Clipboard.setStringAsync("pnpm add @workspace/ui-native")
			.then((): void => {
				setCopied(true);
			})
			.catch((): void => {
				setCopied(false);
			});
	}, []);
	return (
		<Tooltip content={copied ? "Copied" : "Copy"} accessibilityLabel={copied ? "Copied" : "Copy the install command"} asChild className="self-start">
			<IconButton icon={copied ? CheckIcon : CopyIcon} label={copied ? "Copied" : "Copy the install command"} onPress={copy} />
		</Tooltip>
	);
}
