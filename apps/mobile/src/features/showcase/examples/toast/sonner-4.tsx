import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { View } from "react-native";

import { useToast } from "../../../toast/facade";
import type { ToastTone } from "../../../toast/state";

// One toast per tone: each brings its own glyph and tint (loading, a spinner; default, none).
interface ToneOption {
	readonly tone: ToastTone;
	readonly label: string;
	readonly message: string;
}

const TONE_OPTIONS: readonly ToneOption[] = [
	{ tone: "default", label: "Default", message: "Default notification" },
	{ tone: "success", label: "Success", message: "Operation completed" },
	{ tone: "error", label: "Error", message: "Operation failed" },
	{ tone: "warning", label: "Warning", message: "Proceed with caution" },
	{ tone: "info", label: "Info", message: "System update available" },
	{ tone: "loading", label: "Loading", message: "Processing…" },
];

function ToneButton({ option, onSelect }: { readonly option: ToneOption; readonly onSelect: (option: ToneOption) => void }): React.JSX.Element {
	const press = React.useCallback((): void => {
		onSelect(option);
	}, [onSelect, option]);
	return <Button label={option.label} size="sm" variant="outline" onPress={press} className="grow basis-1/4" />;
}

export function Sonner4Example(): React.JSX.Element {
	const toast = useToast();
	const showTone = React.useCallback(
		(option: ToneOption): void => {
			toast.show(option.tone, option.message);
		},
		[toast],
	);
	return (
		<View className="flex-row flex-wrap gap-2">
			{TONE_OPTIONS.map((option: ToneOption): React.JSX.Element => (
				<ToneButton key={option.tone} option={option} onSelect={showTone} />
			))}
		</View>
	);
}
