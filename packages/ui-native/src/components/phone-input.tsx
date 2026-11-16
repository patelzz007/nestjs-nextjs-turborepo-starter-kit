// A phone number with its country (the web kit's `PhoneInput`): a country
// button (its flag and calling code) that opens a searchable sheet of every
// country, and a number field formatted as it is typed (libphonenumber-js,
// the library behind the web's react-phone-number-input). Controlled: `value`
// is the number in E.164 (`+60123456789`) as far as it has been typed, ""
// while it is empty; `onChange(next)` reports it. Whether it is a complete,
// valid number is the form's schema to say.
//
// The country comes from the number itself when it has one (a value or a
// typed `+33…`), else from the person's pick, else `defaultCountry`; with no
// country a globe shows until one is known. `readOnly` keeps the number
// selectable but not editable (a summary). Inside a `Field` it takes the
// field's label and state. Country names are English data (Hermes has no
// `Intl.DisplayNames`); pass `countryName` to show them in another language.

import { cva, type VariantProps } from "class-variance-authority";
import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import GlobeIcon from "lucide-react-native/icons/globe";
import * as React from "react";
import { Pressable, Text, TextInput, type TextInputInstance, View } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { FIELD_SURFACE_FILL, useFieldSurface } from "../lib/field-surface";
import { PHONE_COUNTRY_NAMES } from "../lib/phone-countries";
import { useFieldContext } from "./field";
import { Icon } from "./icon";
import { SelectOptionSheet, type SelectOption } from "./select-field";

export const phoneInputVariants = cva("rounded-button flex-row items-stretch overflow-hidden border", {
	variants: {
		size: { sm: "min-h-10", md: "min-h-12", lg: "min-h-14" },
		state: { default: "border-input", loading: "border-input opacity-60", disabled: "border-input opacity-60", error: "border-destructive" },
		surface: { page: FIELD_SURFACE_FILL.page, card: FIELD_SURFACE_FILL.card, popover: FIELD_SURFACE_FILL.popover },
	},
	defaultVariants: { size: "md", state: "default", surface: "page" },
});

export const phoneInputTextVariants = cva("flex-1 font-sans text-foreground", {
	variants: { size: { sm: "text-body px-3", md: "text-body-lg px-3.5", lg: "text-h3 px-4" } },
	defaultVariants: { size: "md" },
});

export type PhoneInputSize = NonNullable<VariantProps<typeof phoneInputVariants>["size"]>;

/** The picker's default copy; generic and overridable. */
export interface PhoneInputLabels {
	readonly searchPlaceholder: string;
	readonly empty: string;
	/** The country button's name, given the picked country's name (or none). */
	readonly countrySelect: (country: string | null) => string;
	readonly sheetTitle: string;
}

export const DEFAULT_PHONE_INPUT_LABELS: PhoneInputLabels = {
	searchPlaceholder: "Search countries",
	empty: "No country matches",
	countrySelect: (country: string | null): string => (country === null ? "Country: none" : `Country: ${country}`),
	sheetTitle: "Country",
};

/** "A" + this is the regional indicator letter 🇦; two of them draw a country's flag. */
const REGIONAL_INDICATOR_OFFSET = 0x1f1a5;

/** The flag of a country, from its two-letter code (regional indicator letters). */
export function flagOf(country: string): string {
	return country
		.toUpperCase()
		.split("")
		.map((letter: string): string => String.fromCodePoint(REGIONAL_INDICATOR_OFFSET + letter.charCodeAt(0)))
		.join("");
}

/** The country a number belongs to, or `null` when it names none (yet). */
export function countryOfNumber(value: string): CountryCode | null {
	return parsePhoneNumberFromString(value)?.country ?? null;
}

/** A number as it reads while typed in `country` (national), or as typed when there is none. */
export function formatPhoneText(value: string, country: CountryCode | null): string {
	if (value.length === 0) {
		return "";
	}
	const parsed = parsePhoneNumberFromString(value);
	if (parsed === undefined) {
		return value;
	}
	return parsed.country === country ? parsed.formatNational() : parsed.formatInternational();
}

/** What a typed text means: the number in E.164 as far as it is typed ("" when nothing is), the country it shows, and the text to keep. */
export function readPhoneText(text: string, country: CountryCode | null): { readonly value: string; readonly country: CountryCode | null; readonly text: string } {
	const typer = text.trim().startsWith("+") || country === null ? new AsYouType() : new AsYouType(country);
	const formatted = typer.input(text);
	return { value: typer.getNumberValue() ?? "", country: typer.getCountry() ?? country, text: formatted };
}

export interface PhoneInputProps {
	/** The number in E.164, or "". */
	readonly value: string;
	readonly onChange: (value: string) => void;
	/** The country to start from when the number names none. */
	readonly defaultCountry?: CountryCode | undefined;
	/** A country's name in the picker (default: English). */
	readonly countryName?: ((country: CountryCode) => string) | undefined;
	readonly size?: PhoneInputSize | undefined;
	readonly placeholder?: string | undefined;
	/** Selectable but not editable (a confirmation, a summary). */
	readonly readOnly?: boolean | undefined;
	readonly invalid?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	readonly loading?: boolean | undefined;
	readonly accessibilityLabel?: string | undefined;
	readonly labels?: Partial<PhoneInputLabels> | undefined;
	readonly onFocus?: (() => void) | undefined;
	readonly onBlur?: (() => void) | undefined;
	/** Extra classes for the box, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

function englishName(country: CountryCode): string {
	return PHONE_COUNTRY_NAMES[country] ?? country;
}

export const PhoneInput = React.memo(
	React.forwardRef<TextInputInstance, PhoneInputProps>(function PhoneInput(
		{
			value,
			onChange,
			defaultCountry,
			countryName = englishName,
			size = "md",
			placeholder,
			readOnly = false,
			invalid,
			disabled,
			loading,
			accessibilityLabel,
			labels,
			onFocus,
			onBlur,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const field = useFieldContext();
		const surface = useFieldSurface();
		const names = React.useMemo((): PhoneInputLabels => ({ ...DEFAULT_PHONE_INPUT_LABELS, ...labels }), [labels]);
		const state = resolveControlState({ disabled: disabled ?? field?.disabled, loading: loading ?? field?.loading, invalid: invalid ?? field?.invalid });
		const isInactive = isInactiveState(state);
		const [picked, setPicked] = React.useState<CountryCode | null>(defaultCountry ?? null);
		const [draft, setDraft] = React.useState<string | null>(null);
		const [pickerOpen, setPickerOpen] = React.useState<boolean>(false);
		const [query, setQuery] = React.useState<string>("");
		const country = countryOfNumber(value) ?? picked;
		const shown = draft ?? formatPhoneText(value, country);

		const options = React.useMemo(
			(): readonly SelectOption<CountryCode>[] =>
				getCountries()
					.map((code: CountryCode): SelectOption<CountryCode> => ({
						value: code,
						label: `${flagOf(code)}  ${countryName(code)}`,
						description: `+${getCountryCallingCode(code)}`,
					}))
					.sort((a: SelectOption<CountryCode>, b: SelectOption<CountryCode>): number =>
						a.label.slice(a.label.indexOf(" ")).localeCompare(b.label.slice(b.label.indexOf(" "))),
					),
			[countryName],
		);
		const type = React.useCallback(
			(text: string): void => {
				const read = readPhoneText(text, country);
				setDraft(read.text);
				if (read.country !== null && read.country !== country) {
					setPicked(read.country);
				}
				onChange(read.value);
			},
			[country, onChange],
		);
		const leave = React.useCallback((): void => {
			setDraft(null);
			onBlur?.();
		}, [onBlur]);
		const openPicker = React.useCallback((): void => {
			setPickerOpen(true);
		}, []);
		const closePicker = React.useCallback((): void => {
			setPickerOpen(false);
			setQuery("");
		}, []);
		const pickCountry = React.useCallback(
			(next: CountryCode): void => {
				setPicked(next);
				setPickerOpen(false);
				setQuery("");
				const national = parsePhoneNumberFromString(value)?.nationalNumber ?? "";
				onChange(national.length === 0 ? "" : (parsePhoneNumberFromString(national, next)?.number ?? ""));
				setDraft(null);
			},
			[onChange, value],
		);
		const buttonState = React.useMemo(() => ({ disabled: isInactive || readOnly, expanded: pickerOpen }), [isInactive, pickerOpen, readOnly]);
		return (
			<>
				<View className={cn(phoneInputVariants({ size, state, surface }), className)}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={names.countrySelect(country === null ? null : countryName(country))}
						accessibilityState={buttonState}
						disabled={isInactive || readOnly}
						onPress={openPicker}
						className="active:bg-surface-selected flex-row items-center gap-1.5 border-r border-input px-3">
						{country === null ? <Icon icon={GlobeIcon} size="sm" colorClassName="accent-icon" /> : <Text className="text-body-lg">{flagOf(country)}</Text>}
						{country === null ? null : <Text className="text-body font-sans text-muted-foreground">{`+${getCountryCallingCode(country)}`}</Text>}
						<Icon icon={ChevronDownIcon} size="xs" colorClassName="accent-icon" />
					</Pressable>
					<TextInput
						ref={ref}
						value={shown}
						onChangeText={type}
						onFocus={onFocus}
						onBlur={leave}
						editable={!(isInactive || readOnly)}
						selectTextOnFocus={readOnly}
						keyboardType="phone-pad"
						textContentType="telephoneNumber"
						autoComplete="tel"
						placeholder={placeholder}
						placeholderTextColorClassName="accent-muted-foreground"
						accessibilityLabel={accessibilityLabel ?? field?.label}
						accessibilityHint={field?.hint}
						testID={testID}
						className={phoneInputTextVariants({ size })}
					/>
				</View>
				<SelectOptionSheet
					visible={pickerOpen}
					title={names.sheetTitle}
					options={options}
					value={country}
					onSelect={pickCountry}
					onClose={closePicker}
					searchable
					query={query}
					onQueryChange={setQuery}
					searchPlaceholder={names.searchPlaceholder}
					noMatchesMessage={names.empty}
					testID={testID === undefined ? undefined : `${testID}-countries`}
				/>
			</>
		);
	}),
);
