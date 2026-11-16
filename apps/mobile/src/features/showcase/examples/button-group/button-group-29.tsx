import UserPlusIcon from "lucide-react-native/icons/user-plus";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui-native/components/button-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup29Example(): React.JSX.Element {
	return (
		<ButtonGroup variant="separated" accessibilityLabel="Follow, 2.4k followers" className="items-center self-start">
			<Button label="Follow" variant="outline" icon={UserPlusIcon} onPress={ignorePress} />
			<ButtonGroupText label="2.4k followers" variant="plain" />
		</ButtonGroup>
	);
}
