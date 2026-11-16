import { Button } from "@workspace/ui-native/components/button";
import { Popover } from "@workspace/ui-native/components/popover";
import { TextField } from "@workspace/ui-native/components/text-field";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const FIELDS: readonly string[] = ["Name", "Email", "Company", "Phone", "Address", "City"];

export function PopoverDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState("");
	const content = (
		<View className="gap-2">
			{FIELDS.map((field: string): React.JSX.Element => (
				<TextField key={field} label={field} value={value} onChange={setValue} />
			))}
		</View>
	);
	return (
		<Popover content={content} accessibilityLabel="Contact form">
			<Button label="Add contact" variant="outline" onPress={ignorePress} />
		</Popover>
	);
}
