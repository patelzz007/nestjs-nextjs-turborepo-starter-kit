import GitCommitHorizontalIcon from "lucide-react-native/icons/git-commit-horizontal";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import PlayIcon from "lucide-react-native/icons/play";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup, ButtonGroupSeparator } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const ACTIONS: readonly DropdownMenuItemData<string>[] = [
	{ value: "commit", label: "Commit", icon: GitCommitHorizontalIcon },
	{ value: "push", label: "Commit and push" },
	{ value: "sync", label: "Commit and sync" },
];

export function ButtonGroup18Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Run" className="self-start">
			<Button label="Execute" icon={PlayIcon} onPress={ignorePress} />
			<ButtonGroupSeparator tone="primary" />
			<DropdownMenu label="Git actions" variant="primary" size="icon" icon={ChevronDownIcon} items={ACTIONS} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
