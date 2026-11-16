import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import CheckIcon from "lucide-react-native/icons/check";
import CopyIcon from "lucide-react-native/icons/copy";
import { View } from "react-native";

import { snippet, useCopy } from "./code-block-sample";

const SESSION = snippet("session");

// A snippet with no header: an outlined copy button floats over the code's corner.
export function CodeBlock2Example(): React.JSX.Element {
	const { copied, copy } = useCopy(SESSION.code);
	return (
		<View className="w-full">
			<CodeBlock code={SESSION.code} lines={SESSION.lines} />
			<View className="absolute top-2 right-2">
				<IconButton icon={copied ? CheckIcon : CopyIcon} label={copied ? "Copied" : "Copy code"} onPress={copy} variant="secondary" size="sm" />
			</View>
		</View>
	);
}
