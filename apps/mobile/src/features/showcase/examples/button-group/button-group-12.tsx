import AlignCenterIcon from "lucide-react-native/icons/align-center";
import AlignJustifyIcon from "lucide-react-native/icons/align-justify";
import AlignLeftIcon from "lucide-react-native/icons/align-left";
import AlignRightIcon from "lucide-react-native/icons/align-right";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup12Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Text alignment" className="self-start">
			<IconButton icon={AlignLeftIcon} label="Align left" size="sm" onPress={ignorePress} />
			<IconButton icon={AlignCenterIcon} label="Align centre" size="sm" onPress={ignorePress} />
			<IconButton icon={AlignRightIcon} label="Align right" size="sm" onPress={ignorePress} />
			<IconButton icon={AlignJustifyIcon} label="Justify" size="sm" onPress={ignorePress} />
		</ButtonGroup>
	);
}
