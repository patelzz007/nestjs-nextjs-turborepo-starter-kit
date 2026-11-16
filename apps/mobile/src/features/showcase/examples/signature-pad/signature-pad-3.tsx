import { Button } from "@workspace/ui-native/components/button";
import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import { isSignatureEmpty, SignaturePad, useSignatureHistory } from "@workspace/ui-native/components/signature-pad";
import * as React from "react";
import { View } from "react-native";

export function SignaturePad3Example(): React.JSX.Element {
	const signature = useSignatureHistory();
	const [name, setName] = React.useState<string>("");
	const [submitted, setSubmitted] = React.useState<boolean>(false);
	const submit = React.useCallback((): void => {
		setSubmitted(true);
	}, []);
	const missing = submitted && isSignatureEmpty(signature.strokes);
	return (
		<View className="gap-3">
			<Field label="Full name">
				<Input value={name} onChange={setName} />
			</Field>
			<Field label="Signature" error={missing ? "Sign in the box." : undefined}>
				<SignaturePad strokes={signature.strokes} onChange={signature.onChange} invalid={missing} />
			</Field>
			<Button label="Submit" onPress={submit} />
		</View>
	);
}
