import { Button } from "@workspace/ui-native/components/button";
import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import * as React from "react";
import { Text, View } from "react-native";

const FRAMEWORKS: readonly ComboboxOption<string>[] = [
	{ value: "next", label: "Next.js" },
	{ value: "sveltekit", label: "SvelteKit" },
	{ value: "nuxt", label: "Nuxt.js" },
	{ value: "remix", label: "Remix" },
	{ value: "astro", label: "Astro" },
	{ value: "gatsby", label: "Gatsby" },
];

export function Combobox11Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	const [submitted, setSubmitted] = React.useState<string | null>(null);
	const [tried, setTried] = React.useState(false);
	const submit = React.useCallback((): void => {
		setTried(true);
		setSubmitted(value);
	}, [value]);
	return (
		<View className="gap-3">
			<Combobox
				label="Framework"
				options={FRAMEWORKS}
				value={value}
				onChange={setValue}
				placeholder="Select a framework"
				error={tried && value === null ? "Choose a framework to submit." : undefined}
			/>
			<Button label="Submit" onPress={submit} />
			<Text className="text-body font-sans text-muted-foreground">{submitted === null ? "Nothing submitted yet." : `Submitted: ${submitted}`}</Text>
		</View>
	);
}
