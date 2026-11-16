import { Button } from "@workspace/ui-native/components/button";
import { SignaturePad, useSignatureHistory } from "@workspace/ui-native/components/signature-pad";
import * as React from "react";
import { View } from "react-native";

export function SignaturePadDo1Example(): React.JSX.Element {
	const signature = useSignatureHistory();
	return (
		<View className="gap-2">
			<SignaturePad strokes={signature.strokes} onChange={signature.onChange} />
			<Button label="Clear" variant="ghost" size="sm" onPress={signature.clear} />
		</View>
	);
}
