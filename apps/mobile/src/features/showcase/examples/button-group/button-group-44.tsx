import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

const STAGES: readonly string[] = ["Lead", "Qualified", "Proposal", "Negotiation", "Won"];

export function ButtonGroup44Example(): React.JSX.Element {
	const [index, setIndex] = React.useState<number>(1);
	const stages = React.useMemo(
		(): readonly DropdownMenuItemData<string>[] =>
			STAGES.map((name: string, position: number): DropdownMenuItemData<string> => ({ value: name, label: name, kind: "radio", checked: position === index })),
		[index],
	);
	const back = React.useCallback((): void => {
		setIndex((value: number): number => Math.max(0, value - 1));
	}, []);
	const forward = React.useCallback((): void => {
		setIndex((value: number): number => Math.min(STAGES.length - 1, value + 1));
	}, []);
	const jump = React.useCallback((name: string): void => {
		setIndex(STAGES.indexOf(name));
	}, []);
	return (
		<ButtonGroup accessibilityLabel="Pipeline stage" className="self-start">
			<IconButton icon={ChevronLeftIcon} label="Previous stage" disabled={index === 0} onPress={back} />
			<DropdownMenu label={STAGES[index] ?? ""} title="Jump to stage" items={stages} onSelect={jump} />
			<IconButton icon={ChevronRightIcon} label="Next stage" disabled={index === STAGES.length - 1} onPress={forward} />
		</ButtonGroup>
	);
}
