import InfoIcon from "lucide-react-native/icons/info";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

import { ignorePress } from "../example-support";

export function TooltipDo1Example(): React.JSX.Element {
	return (
		<Tooltip content="Your plan renews on the 1st of each month." accessibilityLabel="Plan info" asChild>
			<IconButton icon={InfoIcon} label="Plan info" variant="ghost" onPress={ignorePress} />
		</Tooltip>
	);
}
