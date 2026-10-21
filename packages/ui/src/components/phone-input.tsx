"use client";

// Ported from ReUI (https://reui.io/r/base-vega/phone-input.json):
// react-phone-number-input with the kit's Button, Combobox and Input as its
// country picker and number field. `PhoneInput` and its props (`variant` for
// the size, `popupClassName`, `scrollAreaClassName`, every
// react-phone-number-input prop, `onChange(value)` with "" for an empty field)
// match ReUI, so its examples apply, with these deliberate deviations:
// - The ref lands on the number `<input>` (a form library's ref, focus on error).
// - `disabled` and `aria-invalid` drive a CVA `state` axis: an invalid field
//   reddens the country button too; `aria-invalid` reaches the input.
// - The country search placeholder, its empty state and the country button's
//   accessible name ("Country: Malaysia") come from the `phoneInput` family
//   of `UiKitLabelsProvider`, overridable per usage with `uiKitLabels`
//   (`labels` stays react-phone-number-input's country-name localisation).
// - The kit's `ComboboxList` scrolls the rows itself, so `scrollAreaClassName`
//   styles that list (ReUI accepted it but never applied it).
// - Heights follow the kit's input scale (sm h-8 / default h-9 / lg h-10).
import { Button } from "@workspace/ui/components/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxSeparator, ComboboxTrigger } from "@workspace/ui/components/combobox";
import { Input, type InputProps } from "@workspace/ui/components/input";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva } from "class-variance-authority";
import { GlobeIcon } from "lucide-react";
import * as React from "react";
import * as BasePhoneInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";

/** Copy for the country picker — the `phoneInput` family of `UiKitLabels`. */
export interface PhoneInputLabels {
	/** Placeholder of the country search field. */
	readonly searchPlaceholder: string;
	/** Shown when no country matches the search. */
	readonly empty: string;
	/** Accessible name of the country button, given the selected country's name. */
	readonly countrySelect: (country: string) => string;
	/** The country button's name part when no country is selected (international format). */
	readonly noCountry: string;
}

type PhoneInputSize = "sm" | "default" | "lg";

/** The number field and the country button share one height per size. */
const PHONE_INPUT_HEIGHT: Readonly<Record<PhoneInputSize, string>> = {
	sm: "h-8",
	default: "h-9",
	lg: "h-10",
};

const phoneInputVariants = cva("flex", {
	variants: {
		state: {
			default: "",
			loading: "pointer-events-none opacity-60",
			disabled: "cursor-not-allowed",
			error: "**:data-[slot=combobox-trigger]:border-destructive **:data-[slot=combobox-trigger]:ring-destructive/50",
		},
	},
	defaultVariants: {
		state: "default",
	},
});

/** Marks the library's container element, which receives `className`. */
const PHONE_INPUT_CONTAINER_PROPS: Readonly<Record<"data-slot", string>> = { "data-slot": "phone-input" };

interface PhoneInputContextValue {
	readonly variant: PhoneInputSize;
	readonly popupClassName: string | undefined;
	readonly scrollAreaClassName: string | undefined;
	readonly labels: PhoneInputLabels;
	readonly inputRef: React.ForwardedRef<HTMLInputElement>;
}

const PhoneInputContext = React.createContext<PhoneInputContextValue | null>(null);

function usePhoneInputContext(): PhoneInputContextValue {
	const context = React.useContext(PhoneInputContext);
	if (context === null) {
		throw new Error("PhoneInput parts must be rendered inside <PhoneInput>.");
	}
	return context;
}

type PhoneInputProps = Omit<React.ComponentProps<"input">, "onChange" | "value" | "ref" | "size" | "defaultValue" | "style"> &
	Omit<BasePhoneInput.FeatureProps<object>, "flagComponent" | "countrySelectComponent" | "inputComponent"> & {
		readonly value?: BasePhoneInput.Value | undefined;
		/** Called with the number in E.164 (e.g. "+60123456789"), or "" once the field is emptied. */
		readonly onChange?: ((value: BasePhoneInput.Value) => void) | undefined;
		/** The size (ReUI's name for it). */
		readonly variant?: PhoneInputSize | undefined;
		/** Class name for the country picker popup. */
		readonly popupClassName?: string | undefined;
		/** Class name for the scrolling country list. */
		readonly scrollAreaClassName?: string | undefined;
		/** Per-usage overrides of the `phoneInput` copy from `UiKitLabelsProvider`. */
		readonly uiKitLabels?: UiKitLabelsOverride<"phoneInput"> | undefined;
	};

function FlagComponent({ country, countryName }: BasePhoneInput.FlagProps): React.JSX.Element {
	const Flag = flags[country];

	return (
		<span className="flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-full! [&_svg:not([class*='size-'])]:rounded-sm">
			{Flag === undefined ? <GlobeIcon aria-hidden className="size-4 opacity-60" /> : <Flag title={countryName} />}
		</span>
	);
}

function InputComponent({ className, ref, ...props }: InputProps & { readonly ref?: React.Ref<HTMLInputElement> }): React.JSX.Element {
	const { variant, inputRef } = usePhoneInputContext();
	const setRefs = React.useMemo(() => mergeRefs(ref, inputRef), [ref, inputRef]);

	return <Input ref={setRefs} size={variant} className={cn("rounded-s-none focus:z-1", PHONE_INPUT_HEIGHT[variant], className)} {...props} />;
}

interface CountryEntry {
	readonly label: string;
	readonly value: BasePhoneInput.Country | undefined;
}

/** The props react-phone-number-input passes its `countrySelectComponent`. */
interface CountrySelectProps {
	readonly disabled?: boolean | undefined;
	readonly readOnly?: boolean | undefined;
	readonly value: BasePhoneInput.Country | undefined;
	readonly options: readonly CountryEntry[];
	readonly onChange: (country: BasePhoneInput.Country | undefined) => void;
}

/** Only countries with a code are rows (the library's "International" option has none). */
function isCountryOption(entry: CountryEntry): entry is CountryEntry & { readonly value: BasePhoneInput.Country } {
	return entry.value !== undefined;
}

interface CountryRowProps {
	readonly country: BasePhoneInput.Country;
	readonly label: string;
}

function CountryRow({ country, label }: CountryRowProps): React.JSX.Element {
	return (
		<ComboboxItem value={country} data-slot="phone-input-country">
			<span className="flex items-center gap-2">
				<FlagComponent country={country} countryName={label} />
				<span className="flex-1 truncate">{label}</span>
				<span className="text-muted-foreground">{`+${BasePhoneInput.getCountryCallingCode(country)}`}</span>
			</span>
		</ComboboxItem>
	);
}

function CountrySelect({ disabled = false, readOnly = false, value: selectedCountry, options, onChange }: CountrySelectProps): React.JSX.Element {
	const { variant, popupClassName, scrollAreaClassName, labels } = usePhoneInputContext();
	const [searchValue, setSearchValue] = React.useState("");
	const inert = disabled || readOnly;

	const countryOptions = React.useMemo(() => options.filter(isCountryOption), [options]);
	const filteredCountries = React.useMemo(() => {
		const query = searchValue.toLowerCase();
		return countryOptions.filter((entry): boolean => entry.label.toLowerCase().includes(query));
	}, [countryOptions, searchValue]);
	const filteredCodes = React.useMemo((): BasePhoneInput.Country[] => filteredCountries.map((entry): BasePhoneInput.Country => entry.value), [filteredCountries]);

	const selectedLabel = countryOptions.find((entry): boolean => entry.value === selectedCountry)?.label ?? labels.noCountry;

	const handleValueChange = React.useCallback(
		(country: BasePhoneInput.Country | null): void => {
			if (country !== null) {
				onChange(country);
			}
		},
		[onChange],
	);

	const handleInputValueChange = React.useCallback((query: string): void => {
		setSearchValue(query);
	}, []);

	const triggerRender = React.useMemo(
		() => (
			<Button
				variant="outline"
				size={variant}
				disabled={inert}
				className={cn(
					"flex gap-1 rounded-s-md rounded-e-none border-e-0 px-2.5 py-0 leading-none hover:bg-transparent focus:z-10 data-pressed:bg-transparent",
					PHONE_INPUT_HEIGHT[variant],
				)}
			/>
		),
		[inert, variant],
	);

	return (
		<Combobox<BasePhoneInput.Country>
			items={filteredCodes}
			filter={null}
			value={selectedCountry ?? null}
			onValueChange={handleValueChange}
			inputValue={searchValue}
			onInputValueChange={handleInputValueChange}
			disabled={inert}>
			<ComboboxTrigger render={triggerRender} ariaLabel={labels.countrySelect(selectedLabel)}>
				{selectedCountry === undefined ? <GlobeIcon aria-hidden className="size-4 opacity-60" /> : <FlagComponent country={selectedCountry} countryName={selectedLabel} />}
			</ComboboxTrigger>
			<ComboboxContent className={cn("w-xs", popupClassName)}>
				<ComboboxInput placeholder={labels.searchPlaceholder} showTrigger={false} />
				<ComboboxSeparator />
				<ComboboxEmpty text={labels.empty} className="px-4 py-2.5" />
				<ComboboxList className={scrollAreaClassName}>
					{filteredCountries.map((entry): React.JSX.Element => (
						<CountryRow key={entry.value} country={entry.value} label={entry.label} />
					))}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

/** A phone number field with a searchable country picker; the value is E.164. */
const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
	{ className, variant = "default", popupClassName, scrollAreaClassName, uiKitLabels, onChange, value, disabled, "aria-invalid": ariaInvalid, ...props },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("phoneInput", uiKitLabels);
	const state = resolveFieldState({ disabled, ariaInvalid });

	const contextValue = React.useMemo<PhoneInputContextValue>(
		() => ({ variant, popupClassName, scrollAreaClassName, labels, inputRef: ref }),
		[variant, popupClassName, scrollAreaClassName, labels, ref],
	);

	// The library reads an absent value as an empty field ("" would be parsed as a number).
	const valueProps = React.useMemo((): Pick<BasePhoneInput.Props<object>, "value"> => (value === undefined || value === "" ? {} : { value }), [value]);

	const handleChange = React.useCallback(
		(next?: BasePhoneInput.Value): void => {
			onChange?.(next ?? "");
		},
		[onChange],
	);

	return (
		<PhoneInputContext.Provider value={contextValue}>
			<BasePhoneInput.default
				className={cn(phoneInputVariants({ state }), className)}
				containerComponentProps={PHONE_INPUT_CONTAINER_PROPS}
				flagComponent={FlagComponent}
				countrySelectComponent={CountrySelect}
				inputComponent={InputComponent}
				smartCaret={false}
				disabled={disabled === true}
				aria-invalid={ariaInvalid}
				{...valueProps}
				onChange={handleChange}
				{...props}
			/>
		</PhoneInputContext.Provider>
	);
});

export { PhoneInput, phoneInputVariants };
export type { PhoneInputProps, PhoneInputSize };
