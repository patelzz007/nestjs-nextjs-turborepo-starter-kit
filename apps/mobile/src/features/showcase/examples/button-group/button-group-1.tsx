import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup1Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Archive or report" className="self-start">
			<Button label="Archive" variant="outline" onPress={ignorePress} />
			<Button label="Report" variant="outline" onPress={ignorePress} />
		</ButtonGroup>
	);
}
