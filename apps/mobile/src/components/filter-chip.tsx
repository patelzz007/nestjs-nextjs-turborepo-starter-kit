// A filter as GitHub's app shows one at the top of a list: a rounded chip with
// the current choice and a chevron; pressing it opens a sheet of the options.
// Generic over the option value, controlled and data-agnostic: `value` in,
// `onChange(next)` out.

import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { BottomSheet, SheetOptionRow } from "./bottom-sheet";
import { Icon } from "./icon";

export interface FilterChipOption<TValue extends string> {
	readonly value: TValue;
	readonly label: string;
}

export interface FilterChipProps<TValue extends string> {
	/** What is being filtered — the sheet's title and part of the chip's accessible name. */
	readonly title: string;
	readonly options: readonly FilterChipOption<TValue>[];
	readonly value: TValue;
	readonly onChange: (value: TValue) => void;
	readonly testID?: string;
}

export function FilterChip<TValue extends string>({ title, options, value, onChange, testID }: FilterChipProps<TValue>): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const selected = options.find((option: FilterChipOption<TValue>): boolean => option.value === value);
	const openSheet = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const closeSheet = React.useCallback((): void => {
		setOpen(false);
	}, []);
	const choose = React.useCallback(
		(next: TValue): void => {
			setOpen(false);
			if (next !== value) {
				onChange(next);
			}
		},
		[onChange, value],
	);
	return (
		<View>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${title}: ${selected?.label ?? ""}`}
				accessibilityHint="Opens the choices"
				onPress={openSheet}
				testID={testID}
				className="min-h-9 flex-row items-center gap-1 self-start rounded-full border border-border bg-card px-3.5 py-1.5 active:opacity-70">
				<Text className="font-sans-medium text-sm text-foreground">{selected?.label ?? ""}</Text>
				<Icon icon={ChevronDownIcon} size="sm" colorClassName="accent-muted-foreground" />
			</Pressable>
			<BottomSheet visible={open} title={title} onClose={closeSheet}>
				<View>
					{options.map((option: FilterChipOption<TValue>): React.JSX.Element => (
						<SheetOptionRow key={option.value} value={option.value} label={option.label} selected={option.value === value} onSelect={choose} />
					))}
				</View>
			</BottomSheet>
		</View>
	);
}
