import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { FieldSet } from "@workspace/ui-native/components/field";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const VISIBILITY: readonly RadioOption<string>[] = [
	{ value: "public", label: "Public", description: "Anyone can see your profile." },
	{ value: "private", label: "Private", description: "Only you can see it." },
];

export function Field4Example(): React.JSX.Element {
	const [updates, setUpdates] = React.useState<boolean>(true);
	const [visibility, setVisibility] = React.useState<string | null>("public");
	return (
		<View className="gap-6">
			<FieldSet legend="Email me about">
				<Checkbox label="Security alerts" description="Always on: they protect your account." checked locked onChange={ignorePress} />
				<Checkbox label="Product updates" checked={updates} onChange={setUpdates} />
			</FieldSet>
			<RadioGroup label="Profile" options={VISIBILITY} value={visibility} onChange={setVisibility} />
		</View>
	);
}
