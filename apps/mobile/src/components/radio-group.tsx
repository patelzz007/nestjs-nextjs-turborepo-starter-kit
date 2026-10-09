// A single choice from a short list (Appearance, App lock timeout). Generic
// over the option value, controlled: `value` in, `onChange(next)` out.

import * as React from "react";
import { Pressable, Text, View } from "react-native";

export interface RadioOption<TValue extends string | number> {
	readonly value: TValue;
	readonly label: string;
	readonly description?: string;
}

export interface RadioGroupProps<TValue extends string | number> {
	/** The group's accessible name. */
	readonly label: string;
	readonly options: readonly RadioOption<TValue>[];
	readonly value: TValue;
	readonly onChange: (value: TValue) => void;
	readonly disabled?: boolean;
}

interface RadioRowProps<TValue extends string | number> {
	readonly option: RadioOption<TValue>;
	readonly selected: boolean;
	readonly disabled: boolean;
	readonly onSelect: (value: TValue) => void;
}

function RadioRow<TValue extends string | number>({ option, selected, disabled, onSelect }: RadioRowProps<TValue>): React.JSX.Element {
	const handlePress = React.useCallback((): void => {
		onSelect(option.value);
	}, [onSelect, option.value]);
	return (
		<Pressable
			accessibilityRole="radio"
			accessibilityLabel={option.label}
			accessibilityHint={option.description}
			accessibilityState={{ checked: selected, disabled }}
			disabled={disabled}
			onPress={handlePress}
			className="min-h-11 flex-row items-center gap-3 py-2">
			<View className={`size-6 items-center justify-center rounded-full border-2 ${selected ? "border-primary" : "border-input"}`}>
				{selected ? <View className="size-3 rounded-full bg-primary" /> : null}
			</View>
			<View className="flex-1 gap-0.5">
				<Text className="text-base text-foreground">{option.label}</Text>
				{option.description === undefined ? null : <Text className="text-sm text-muted-foreground">{option.description}</Text>}
			</View>
		</Pressable>
	);
}

export function RadioGroup<TValue extends string | number>({ label, options, value, onChange, disabled = false }: RadioGroupProps<TValue>): React.JSX.Element {
	return (
		<View accessibilityRole="radiogroup" accessibilityLabel={label} className="gap-1">
			{options.map((option: RadioOption<TValue>): React.JSX.Element => (
				<RadioRow key={String(option.value)} option={option} selected={option.value === value} disabled={disabled} onSelect={onChange} />
			))}
		</View>
	);
}
