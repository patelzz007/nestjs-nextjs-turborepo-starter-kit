import { Button } from "@workspace/ui-native/components/button";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

import { ignorePress } from "../example-support";

export function TooltipDo2Example(): React.JSX.Element {
	return (
		<Tooltip content="Only owners can delete a project." accessibilityLabel="Delete project, unavailable" className="self-start">
			<Button label="Delete project" variant="destructive" disabled onPress={ignorePress} />
		</Tooltip>
	);
}
