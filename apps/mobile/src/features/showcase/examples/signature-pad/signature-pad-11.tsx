import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import { isSignatureEmpty, SignaturePad, useSignatureHistory } from "@workspace/ui-native/components/signature-pad";
import * as React from "react";
import { View } from "react-native";

export function SignaturePad11Example(): React.JSX.Element {
	const signature = useSignatureHistory();
	const [receiver, setReceiver] = React.useState<string>("");
	const [confirmed, setConfirmed] = React.useState<boolean>(false);
	const confirm = React.useCallback((): void => {
		setConfirmed(true);
	}, []);
	return (
		<Card title="Order #4821" description="Deliver to 12 Jalan Ampang">
			<View className="gap-3">
				<Field label="Received by">
					<Input value={receiver} onChange={setReceiver} editable={!confirmed} />
				</Field>
				<SignaturePad strokes={signature.strokes} onChange={signature.onChange} readOnly={confirmed} />
				<Button
					label={confirmed ? "Delivered" : "Confirm delivery"}
					size="lg"
					disabled={confirmed || receiver.trim().length === 0 || isSignatureEmpty(signature.strokes)}
					onPress={confirm}
				/>
			</View>
		</Card>
	);
}
