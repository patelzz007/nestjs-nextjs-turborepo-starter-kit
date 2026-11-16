import AlignCenterIcon from "lucide-react-native/icons/align-center";
import AlignLeftIcon from "lucide-react-native/icons/align-left";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroupDo2Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Text alignment" className="self-start">
			<IconButton icon={AlignLeftIcon} label="Align left" onPress={ignorePress} />
			<IconButton icon={AlignCenterIcon} label="Align centre" onPress={ignorePress} />
		</ButtonGroup>
	);
}
