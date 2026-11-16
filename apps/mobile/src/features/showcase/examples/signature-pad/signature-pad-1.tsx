import { Button } from "@workspace/ui-native/components/button";
import { isSignatureEmpty, SignaturePad, type SignatureStroke, useSignatureHistory } from "@workspace/ui-native/components/signature-pad";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function SignaturePad1Example(): React.JSX.Element {
	const signature = useSignatureHistory();
	const [saved, setSaved] = React.useState<readonly SignatureStroke[] | null>(null);
	const save = React.useCallback((): void => {
		setSaved(signature.strokes);
	}, [signature.strokes]);
	return (
		<View className="gap-3">
			<SignaturePad strokes={signature.strokes} onChange={signature.onChange} />
			<View className="flex-row justify-end gap-2">
				<Button label="Clear" variant="ghost" size="sm" onPress={signature.clear} />
				<Button label="Save" size="sm" disabled={isSignatureEmpty(signature.strokes)} onPress={save} />
			</View>
			{saved === null ? null : <SignaturePad strokes={saved} onChange={ignorePress} readOnly size="sm" />}
		</View>
	);
}
