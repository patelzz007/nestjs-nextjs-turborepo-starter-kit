import SaveIcon from "lucide-react-native/icons/save";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

import { ignorePress } from "../example-support";

const SHORTCUT: readonly string[] = ["⌘", "S"];

export function Kbd5Example(): React.JSX.Element {
	return (
		<Tooltip content="Save" shortcut={SHORTCUT} accessibilityLabel="Save, shortcut Command S" asChild className="self-start">
			<IconButton icon={SaveIcon} label="Save" onPress={ignorePress} />
		</Tooltip>
	);
}
