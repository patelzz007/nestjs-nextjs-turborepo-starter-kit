import { Button } from "@workspace/ui-native/components/button";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Tooltip1Example(): React.JSX.Element {
	return (
		<Tooltip content="Add to library" accessibilityLabel="Add" asChild>
			<Button label="Long press me" variant="outline" onPress={ignorePress} />
		</Tooltip>
	);
}
