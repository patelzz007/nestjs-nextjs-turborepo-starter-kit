import SearchIcon from "lucide-react-native/icons/search";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

import { ignorePress } from "../example-support";

/** The search's shortcut on a hardware keyboard. */
const SHORTCUT: readonly string[] = ["⌘", "K"];

export function Button54Example(): React.JSX.Element {
	return (
		<Tooltip content="Search" shortcut={SHORTCUT} accessibilityLabel="Search, shortcut Command K" asChild className="self-start">
			<IconButton icon={SearchIcon} label="Search" onPress={ignorePress} />
		</Tooltip>
	);
}
