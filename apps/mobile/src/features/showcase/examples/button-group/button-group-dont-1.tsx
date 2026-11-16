import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroupDont1Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Actions" className="self-start">
			<Button label="Save" variant="outline" onPress={ignorePress} />
			<Button label="Log out" variant="outline" onPress={ignorePress} />
		</ButtonGroup>
	);
}
