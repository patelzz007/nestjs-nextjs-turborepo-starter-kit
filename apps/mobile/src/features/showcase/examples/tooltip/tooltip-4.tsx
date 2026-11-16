import SaveIcon from "lucide-react-native/icons/save";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

import { ignorePress } from "../example-support";

const SAVE_KEYS: readonly string[] = ["⌘", "S"];

export function Tooltip4Example(): React.JSX.Element {
	return (
		<Tooltip content="Save" shortcut={SAVE_KEYS} accessibilityLabel="Save" asChild>
			<IconButton icon={SaveIcon} label="Save" variant="secondary" size="sm" onPress={ignorePress} />
		</Tooltip>
	);
}
