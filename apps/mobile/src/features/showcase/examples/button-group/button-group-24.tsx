import LayoutGridIcon from "lucide-react-native/icons/layout-grid";
import ListIcon from "lucide-react-native/icons/list";
import Table2Icon from "lucide-react-native/icons/table-2";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup24Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Dashboard view" className="self-start">
			<IconButton icon={LayoutGridIcon} label="Grid view" onPress={ignorePress} />
			<IconButton icon={ListIcon} label="List view" onPress={ignorePress} />
			<IconButton icon={Table2Icon} label="Table view" onPress={ignorePress} />
		</ButtonGroup>
	);
}
