import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";
import { View } from "react-native";

interface PermissionGroup {
	readonly name: string;
	readonly leaves: readonly string[];
}

const GROUPS: readonly PermissionGroup[] = [
	{ name: "Billing", leaves: ["Read invoices", "Pay invoices"] },
	{ name: "Members", leaves: ["Invite members", "Remove members"] },
];
const ALL: readonly string[] = GROUPS.flatMap((group: PermissionGroup): readonly string[] => group.leaves);

export function Checkbox16Example(): React.JSX.Element {
	const [on, setOn] = React.useState<readonly string[]>(["Read invoices"]);
	const isOn = React.useCallback((leaf: string): boolean => on.includes(leaf), [on]);
	const allOn = ALL.every(isOn);
	const someOn = ALL.some(isOn);
	const setGroup = React.useCallback(
		(leaves: readonly string[]) =>
			(checked: boolean): void => {
				setOn((current: readonly string[]): readonly string[] =>
					checked ? [...new Set([...current, ...leaves])] : current.filter((leaf: string): boolean => !leaves.includes(leaf)),
				);
			},
		[],
	);
	const setAll = setGroup(ALL);
	return (
		<View className="gap-1">
			<Checkbox label="All permissions" checked={allOn} indeterminate={allOn ? false : someOn} onChange={setAll} />
			{GROUPS.map(({ name, leaves }: PermissionGroup): React.JSX.Element => (
				<View key={name} className="pl-6">
					<Checkbox label={name} checked={leaves.every(isOn)} indeterminate={leaves.every(isOn) ? false : leaves.some(isOn)} onChange={setGroup(leaves)} />
					<View className="pl-6">
						{leaves.map((leaf: string): React.JSX.Element => (
							<Checkbox key={leaf} label={leaf} size="sm" checked={isOn(leaf)} onChange={setGroup([leaf])} />
						))}
					</View>
				</View>
			))}
		</View>
	);
}
