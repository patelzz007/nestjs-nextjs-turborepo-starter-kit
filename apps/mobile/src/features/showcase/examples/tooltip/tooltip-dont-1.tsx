import InfoIcon from "lucide-react-native/icons/info";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

import { ignorePress } from "../example-support";

export function TooltipDont1Example(): React.JSX.Element {
	return (
		<Tooltip content="Info" accessibilityLabel="Info" asChild>
			<IconButton icon={InfoIcon} label="Info" variant="ghost" onPress={ignorePress} />
		</Tooltip>
	);
}
