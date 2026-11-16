import Share2Icon from "lucide-react-native/icons/share-2";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui-native/components/button-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup31Example(): React.JSX.Element {
	return (
		<ButtonGroup variant="separated" accessibilityLabel="Share, 128 shares" className="items-center self-start">
			<Button label="Share" icon={Share2Icon} onPress={ignorePress} />
			<ButtonGroupText label="128 shares" variant="plain" size="sm" />
		</ButtonGroup>
	);
}
