import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup, ButtonGroupSeparator } from "@workspace/ui-native/components/button-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup23Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Library" className="self-start">
			<Button label="Files" onPress={ignorePress} />
			<ButtonGroupSeparator tone="primary" />
			<Button label="Folder" onPress={ignorePress} />
			<ButtonGroupSeparator tone="primary" />
			<Button label="Media" onPress={ignorePress} />
		</ButtonGroup>
	);
}
