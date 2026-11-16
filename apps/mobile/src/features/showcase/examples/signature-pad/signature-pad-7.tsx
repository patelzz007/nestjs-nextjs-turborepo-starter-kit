import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { isSignatureEmpty, SignaturePad, useSignatureHistory } from "@workspace/ui-native/components/signature-pad";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function SignaturePad7Example(): React.JSX.Element {
	const signature = useSignatureHistory();
	const [agreed, setAgreed] = React.useState<boolean>(false);
	return (
		<Card title="Service agreement">
			<View className="gap-3">
				<SignaturePad strokes={signature.strokes} onChange={signature.onChange} />
				<Checkbox label="I have read and agree to the agreement" checked={agreed} onChange={setAgreed} />
				<Button label="Sign agreement" disabled={!agreed || isSignatureEmpty(signature.strokes)} onPress={ignorePress} />
			</View>
		</Card>
	);
}
