import { Button } from "@workspace/ui-native/components/button";
import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function Input15Example(): React.JSX.Element {
	const [phone, setPhone] = React.useState<string>("");
	const [country, setCountry] = React.useState<string>("Malaysia");
	const [address, setAddress] = React.useState<string>("");
	return (
		<View className="gap-4">
			<View className="flex-row gap-3">
				<Field label="Phone" className="flex-1">
					<Input value={phone} onChange={setPhone} keyboardType="phone-pad" />
				</Field>
				<Field label="Country" className="flex-1">
					<Input value={country} onChange={setCountry} />
				</Field>
			</View>
			<Field label="Address">
				<Input value={address} onChange={setAddress} textContentType="fullStreetAddress" />
			</Field>
			<Button label="Send" onPress={ignorePress} />
		</View>
	);
}
