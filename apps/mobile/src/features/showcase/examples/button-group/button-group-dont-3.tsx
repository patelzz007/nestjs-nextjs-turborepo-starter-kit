import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroupDont3Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="View">
			<Button label="Hour" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="Day" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="Week" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="Month" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="Quarter" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="Year" variant="outline" size="sm" onPress={ignorePress} />
		</ButtonGroup>
	);
}
