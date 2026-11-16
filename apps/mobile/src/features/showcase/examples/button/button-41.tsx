import CheckIcon from "lucide-react-native/icons/check";
import CopyIcon from "lucide-react-native/icons/copy";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import * as Clipboard from "expo-clipboard";

/** How long the button says Copied, in ms. */
const COPIED_FOR_MS = 1500;

export function Button41Example(): React.JSX.Element {
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
	return <Button label={copied ? "Copied" : "Copy"} variant="outline" icon={copied ? CheckIcon : CopyIcon} onPress={copy} />;
}
