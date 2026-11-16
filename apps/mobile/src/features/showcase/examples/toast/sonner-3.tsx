import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { View } from "react-native";

import { useToast } from "../../../toast/facade";
import type { ToastPosition } from "../../../toast/state";

// A phone shows a toast in one of two places: under the header (the default,
// clear of the keyboard) or above the home indicator (near the thumb).
interface PositionOption {
	readonly position: ToastPosition;
	readonly label: string;
}

const POSITION_OPTIONS: readonly PositionOption[] = [
	{ position: "top", label: "Top" },
	{ position: "bottom", label: "Bottom" },
];

function PositionButton({ option, onSelect }: { readonly option: PositionOption; readonly onSelect: (option: PositionOption) => void }): React.JSX.Element {
	const press = React.useCallback((): void => {
		onSelect(option);
	}, [onSelect, option]);
	return <Button label={option.label} size="sm" variant="outline" onPress={press} className="flex-1" />;
}

export function Sonner3Example(): React.JSX.Element {
	const toast = useToast();
	const showAt = React.useCallback(
		(option: PositionOption): void => {
			toast.show("default", `Notification appears at the ${option.label.toLowerCase()}.`, { title: option.label, position: option.position });
		},
		[toast],
	);
	return (
		<View className="flex-row gap-2">
			{POSITION_OPTIONS.map((option: PositionOption): React.JSX.Element => (
				<PositionButton key={option.position} option={option} onSelect={showAt} />
			))}
		</View>
	);
}
