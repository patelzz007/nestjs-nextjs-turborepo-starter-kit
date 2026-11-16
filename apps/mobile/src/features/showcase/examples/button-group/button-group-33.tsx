import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

const ENVIRONMENTS: readonly string[] = ["Production", "Preview", "Development"];
/** Each range and the group it is listed under. */
const RANGES: readonly (readonly [string, string])[] = [
	["Last hour", "Recent"],
	["Last 24 hours", "Recent"],
	["Last 7 days", "Recent"],
	["Last 30 days", "Observability Plus"],
	["Last 90 days", "Observability Plus"],
];

export function ButtonGroup33Example(): React.JSX.Element {
	const [environment, setEnvironment] = React.useState<string>("Production");
	const [range, setRange] = React.useState<string>("Last 24 hours");
	const environments = React.useMemo(
		(): readonly DropdownMenuItemData<string>[] =>
			ENVIRONMENTS.map((name: string): DropdownMenuItemData<string> => ({ value: name, label: name, kind: "radio", checked: name === environment })),
		[environment],
	);
	const ranges = React.useMemo(
		(): readonly DropdownMenuItemData<string>[] =>
			RANGES.map(([name, group]: readonly [string, string]): DropdownMenuItemData<string> => ({ value: name, label: name, group, kind: "radio", checked: name === range })),
		[range],
	);
	return (
		<ButtonGroup accessibilityLabel="Observability filters" className="self-start">
			<DropdownMenu label={environment} title="Environment" items={environments} onSelect={setEnvironment} />
			<DropdownMenu label={range} title="Time range" items={ranges} onSelect={setRange} />
		</ButtonGroup>
	);
}
