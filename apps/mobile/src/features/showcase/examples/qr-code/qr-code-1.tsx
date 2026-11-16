import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import { QrCode } from "@workspace/ui-native/components/qr-code";
import * as React from "react";
import { View } from "react-native";

const DEFAULT_VALUE = "https://acme.example/claim/R-2026-0042";

// A QR code redrawn as its value is typed; an empty field falls back to the default link.
export function QrCode1Example(): React.JSX.Element {
	const [value, setValue] = React.useState(DEFAULT_VALUE);
	return (
		<View className="w-full gap-4">
			<Field label="Encoded value">
				<Input value={value} onChange={setValue} autoCapitalize="none" />
			</Field>
			<QrCode value={value.length > 0 ? value : DEFAULT_VALUE} label="QR code of the encoded value" className="self-center" />
		</View>
	);
}
