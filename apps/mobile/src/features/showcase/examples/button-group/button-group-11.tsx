import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup11Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Pages" className="self-start">
			<IconButton icon={ChevronLeftIcon} label="Previous page" size="sm" onPress={ignorePress} />
			<Button label="1" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="2" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="3" variant="outline" size="sm" onPress={ignorePress} />
			<IconButton icon={ChevronRightIcon} label="Next page" size="sm" onPress={ignorePress} />
		</ButtonGroup>
	);
}
