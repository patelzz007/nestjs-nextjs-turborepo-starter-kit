import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";

const COUNTRIES: readonly string[] = [
	"Afghanistan",
	"Albania",
	"Algeria",
	"Andorra",
	"Angola",
	"Argentina",
	"Armenia",
	"Australia",
	"Austria",
	"Azerbaijan",
	"Bahamas",
	"Bahrain",
	"Bangladesh",
	"Barbados",
	"Belarus",
	"Belgium",
	"Belize",
	"Benin",
	"Bhutan",
	"Bolivia",
];

export function NativeSelectDont1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="native-select-dont-1">Country</FieldLabel>
			<NativeSelect id="native-select-dont-1" defaultValue="">
				<NativeSelectOption value="">Choose a country</NativeSelectOption>
				{COUNTRIES.map((country: string): React.JSX.Element => (
					<NativeSelectOption key={country} value={country}>
						{country}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
