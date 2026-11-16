// The platform's own picker behind a kit-styled field (the web kit's
// `NativeSelect`, the browser's own select): on iOS the system action sheet
// (ActionSheetIOS, lib/system-picker.ios.ts) lists the options, with disabled ones greyed out by the
// system; elsewhere — Android has no system list picker in React Native —
// the kit's option sheet does, with groups under their headings. Best for a
// short, plain list where the system's look is wanted; `SelectField` is the
// kit's richer picker. Controlled: `value` in, `onChange(next)` out.
//
// The trigger is `SelectField`'s, so the two look the same in a form; inside
// a `Field` it takes the field's label and state.

import * as React from "react";
import type { ViewInstance } from "react-native";

import { showSystemPicker } from "../lib/system-picker";
import type { ValueHandler } from "../lib/value-handler";
import { useFieldContext } from "./field";
import { SelectOptionSheet, SelectTrigger, type SelectOption, type SelectSize, type SelectVariant } from "./select-field";

export interface NativeSelectOption<TValue extends string> {
	readonly value: TValue;
	readonly label: string;
	readonly disabled?: boolean | undefined;
	/** The heading the option is listed under (the kit's sheet; the iOS sheet lists them in order). */
	readonly group?: string | undefined;
}

/** The picker's default copy; generic and overridable. */
export interface NativeSelectLabels {
	/** The iOS sheet's dismiss button. */
	readonly cancel: string;
}

export const DEFAULT_NATIVE_SELECT_LABELS: NativeSelectLabels = { cancel: "Cancel" };

export interface NativeSelectProps<TValue extends string> {
	/** The control's name ("Country"), and the sheet's title. */
	readonly label: string;
	readonly options: readonly NativeSelectOption<TValue>[];
	readonly value: NoInfer<TValue> | null;
	readonly onChange: ValueHandler<TValue>;
	/** Shown while nothing is picked. */
	readonly placeholder?: string | undefined;
	readonly variant?: SelectVariant | undefined;
	readonly size?: SelectSize | undefined;
	readonly disabled?: boolean | undefined;
	readonly invalid?: boolean | undefined;
	readonly labels?: Partial<NativeSelectLabels> | undefined;
	/** Extra classes for the trigger, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** `NativeSelect`'s call signature: generic over the option value, which `forwardRef` / `memo` alone would erase. */
export type NativeSelectComponent = <TValue extends string>(props: NativeSelectProps<TValue> & React.RefAttributes<ViewInstance>) => React.ReactNode;

/** The options as the kit's sheet lists them: a group's options under it, its heading in the first one's description. */
export function sheetOptionsOf<TValue extends string>(options: readonly NativeSelectOption<TValue>[]): readonly SelectOption<TValue>[] {
	return options.map((option: NativeSelectOption<TValue>, index: number): SelectOption<TValue> => {
		// `.at(-1)` would wrap to the last option, so the first one always starts its group.
		const previous = index === 0 ? undefined : options.at(index - 1);
		const heading = option.group !== undefined && previous?.group !== option.group ? option.group : undefined;
		return {
			value: option.value,
			label: option.label,
			...(option.disabled === true ? { disabled: true } : {}),
			...(heading === undefined ? {} : { description: heading }),
		};
	});
}

export const NativeSelect: NativeSelectComponent = React.memo(
	React.forwardRef<ViewInstance, NativeSelectProps<string>>(function NativeSelect(
		{ label, options, value, onChange, placeholder, variant, size, disabled, invalid, labels, className, testID },
		ref,
	): React.JSX.Element {
		const field = useFieldContext();
		const cancel = labels?.cancel ?? DEFAULT_NATIVE_SELECT_LABELS.cancel;
		const [sheetOpen, setSheetOpen] = React.useState<boolean>(false);
		const chosen = options.find((option: NativeSelectOption<string>): boolean => option.value === value);
		const open = React.useCallback((): void => {
			const shown = showSystemPicker({
				title: label,
				options: options.map((option: NativeSelectOption<string>): string => option.label),
				cancel,
				disabledIndices: options.flatMap((option: NativeSelectOption<string>, index: number): number[] => (option.disabled === true ? [index] : [])),
				onPick: (index: number): void => {
					const option = options.at(index);
					if (option !== undefined) {
						onChange(option.value);
					}
				},
			});
			if (!shown) {
				setSheetOpen(true);
			}
		}, [cancel, label, onChange, options]);
		const close = React.useCallback((): void => {
			setSheetOpen(false);
		}, []);
		const pick = React.useCallback(
			(next: string): void => {
				setSheetOpen(false);
				onChange(next);
			},
			[onChange],
		);
		const noQuery = React.useCallback((): void => {
			// The list is short: the kit's sheet shows it without a search.
		}, []);
		return (
			<>
				<SelectTrigger
					ref={ref}
					label={field?.label ?? label}
					valueLabel={chosen?.label}
					placeholder={placeholder}
					expanded={sheetOpen}
					onPress={open}
					variant={variant}
					size={size}
					disabled={disabled ?? field?.disabled}
					invalid={invalid ?? field?.invalid}
					className={className}
					testID={testID}
				/>
				<SelectOptionSheet
					visible={sheetOpen}
					title={label}
					options={sheetOptionsOf(options)}
					value={value}
					onSelect={pick}
					onClose={close}
					query=""
					onQueryChange={noQuery}
					testID={testID === undefined ? undefined : `${testID}-sheet`}
				/>
			</>
		);
	}),
);
