import CheckIcon from "lucide-react-native/icons/check";
import CopyIcon from "lucide-react-native/icons/copy";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";
import * as Clipboard from "expo-clipboard";

import { ignorePress } from "../example-support";

const LINK = "https://acme.com/s/8f2k1";

export function InputGroup11Example(): React.JSX.Element {
	const [copied, setCopied] = React.useState<boolean>(false);
	const copy = React.useCallback((): void => {
		Clipboard.setStringAsync(LINK)
			.then((): void => {
				setCopied(true);
			})
			.catch((): void => {
				setCopied(false);
			});
	}, []);
	return (
		<InputGroup
			value={LINK}
			onChange={ignorePress}
			editable={false}
			selectTextOnFocus
			accessibilityLabel="Share link"
			trailing={<IconButton icon={copied ? CheckIcon : CopyIcon} label={copied ? "Copied" : "Copy the link"} variant="ghost" size="sm" onPress={copy} />}
		/>
	);
}
