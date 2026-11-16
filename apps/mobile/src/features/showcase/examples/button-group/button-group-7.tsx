import CircleDotIcon from "lucide-react-native/icons/circle-dot";
import ExternalLinkIcon from "lucide-react-native/icons/external-link";
import GitBranchIcon from "lucide-react-native/icons/git-branch";
import RefreshCwIcon from "lucide-react-native/icons/refresh-cw";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

const BRANCHES: readonly string[] = ["main", "develop", "release/2.4"];

export function ButtonGroup7Example(): React.JSX.Element {
	const [branch, setBranch] = React.useState<string>("main");
	const branches = React.useMemo(
		(): readonly DropdownMenuItemData<string>[] =>
			BRANCHES.map((name: string): DropdownMenuItemData<string> => ({ value: name, label: name, kind: "radio", checked: name === branch })),
		[branch],
	);
	return (
		<ButtonGroup accessibilityLabel="Deployment" className="self-start">
			<DropdownMenu label={branch} title="Branch" icon={GitBranchIcon} items={branches} onSelect={setBranch} />
			<ButtonGroupText label="Production" icon={CircleDotIcon} />
			<IconButton icon={RefreshCwIcon} label="Redeploy" onPress={ignorePress} className="h-12 w-12" />
			<IconButton icon={ExternalLinkIcon} label="Open the site" onPress={ignorePress} className="h-12 w-12" />
		</ButtonGroup>
	);
}
