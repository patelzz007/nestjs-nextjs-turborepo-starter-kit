import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { View } from "react-native";

import { useToast } from "../../../toast/facade";

// `durationMs` sets how long a toast stays (its countdown bar drains over it);
// `null` keeps it until it is closed.
interface DurationOption {
	readonly label: string;
	readonly title: string;
	readonly message: string;
	readonly durationMs: number | null;
}

const QUICK_MS = 2_000;
const STANDARD_MS = 5_000;
const EXTENDED_MS = 10_000;

const DURATION_OPTIONS: readonly DurationOption[] = [
	{ label: "2s Duration", title: "Quick notice", message: "Disappears in 2 seconds.", durationMs: QUICK_MS },
	{ label: "5s Duration", title: "Standard notice", message: "Disappears in 5 seconds.", durationMs: STANDARD_MS },
	{ label: "10s Duration", title: "Extended notice", message: "Stays for 10 seconds.", durationMs: EXTENDED_MS },
	{ label: "Persistent", title: "Persistent notice", message: "This toast stays until dismissed.", durationMs: null },
];

function DurationButton({ option, onSelect }: { readonly option: DurationOption; readonly onSelect: (option: DurationOption) => void }): React.JSX.Element {
	const press = React.useCallback((): void => {
		onSelect(option);
	}, [onSelect, option]);
	return <Button label={option.label} size="sm" variant="outline" onPress={press} className="grow basis-1/3" />;
}

export function Sonner5Example(): React.JSX.Element {
	const toast = useToast();
	const showFor = React.useCallback(
		(option: DurationOption): void => {
			toast.show("default", option.message, { title: option.title, durationMs: option.durationMs });
		},
		[toast],
	);
	return (
		<View className="flex-row flex-wrap gap-2">
			{DURATION_OPTIONS.map((option: DurationOption): React.JSX.Element => (
				<DurationButton key={option.label} option={option} onSelect={showFor} />
			))}
		</View>
	);
}
