import HeartIcon from "lucide-react-native/icons/heart";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui-native/components/button-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup8Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Like, 1.2K likes" className="self-start">
			<Button label="Like" variant="outline" icon={HeartIcon} onPress={ignorePress} />
			<ButtonGroupText label="1.2K" />
		</ButtonGroup>
	);
}
