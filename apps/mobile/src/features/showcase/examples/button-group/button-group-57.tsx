import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";

const MODES: readonly string[] = ["Assist", "Review", "Auto"];
const CAPS: readonly string[] = ["2k credits", "5k credits", "10k credits", "No cap"];

interface ModeButtonProps {
	readonly name: string;
	readonly picked: boolean;
	readonly onPick: (name: string) => void;
}

function ModeButton({ name, picked, onPick }: ModeButtonProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPick(name);
	}, [name, onPick]);
	return <Button label={name} variant={picked ? "secondary" : "outline"} size="sm" onPress={press} />;
}

export function ButtonGroup57Example(): React.JSX.Element {
	const [mode, setMode] = React.useState<string>("Review");
	const [cap, setCap] = React.useState<string>("2k credits");
	const caps = React.useMemo(
		(): readonly DropdownMenuItemData<string>[] =>
			CAPS.map((name: string): DropdownMenuItemData<string> => ({ value: name, label: name, kind: "radio", checked: name === cap })),
		[cap],
	);
	return (
		<ButtonGroup variant="separated" accessibilityLabel="Agent" className="items-center self-start">
			<ButtonGroup accessibilityLabel="Agent mode">
				{MODES.map((name: string): React.JSX.Element => (
					<ModeButton key={name} name={name} picked={mode === name} onPick={setMode} />
				))}
			</ButtonGroup>
			<Separator orientation="vertical" className="h-6" />
			<DropdownMenu label={`Cap: ${cap}`} size="sm" title="Credit cap" items={caps} onSelect={setCap} />
		</ButtonGroup>
	);
}
