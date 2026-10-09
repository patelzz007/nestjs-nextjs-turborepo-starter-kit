// A labelled checkbox. Controlled: `checked` in, `onChange(next)` out.

import * as React from "react";
import { Pressable, Text, View } from "react-native";

export interface CheckboxProps {
	readonly label: string;
	readonly checked: boolean;
	readonly onChange: (checked: boolean) => void;
	readonly disabled?: boolean;
	readonly testID?: string;
}

export function Checkbox({ label, checked, onChange, disabled = false, testID }: CheckboxProps): React.JSX.Element {
	const handlePress = React.useCallback((): void => {
		onChange(!checked);
	}, [checked, onChange]);
	return (
		<Pressable
			accessibilityRole="checkbox"
			accessibilityLabel={label}
			accessibilityState={{ checked, disabled }}
			disabled={disabled}
			onPress={handlePress}
			testID={testID}
			className="min-h-11 flex-row items-center gap-3 py-2">
			<View className={`size-6 items-center justify-center rounded-md border-2 ${checked ? "border-primary bg-primary" : "border-input bg-card"}`}>
				{checked ? <Text className="text-sm font-bold text-primary-foreground">✓</Text> : null}
			</View>
			<Text className="flex-1 text-base text-foreground">{label}</Text>
		</Pressable>
	);
}
