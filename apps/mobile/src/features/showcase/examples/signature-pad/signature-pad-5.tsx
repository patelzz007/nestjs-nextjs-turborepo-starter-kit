import { Button } from "@workspace/ui-native/components/button";
import { CodeBlock } from "@workspace/ui-native/components/code-block";
import { SignaturePad, signatureToSvg, useSignatureHistory } from "@workspace/ui-native/components/signature-pad";
import * as React from "react";
import { View } from "react-native";

export function SignaturePad5Example(): React.JSX.Element {
	const signature = useSignatureHistory();
	const [output, setOutput] = React.useState<string | null>(null);
	const showSvg = React.useCallback((): void => {
		setOutput(signatureToSvg(signature.strokes, { width: 320, height: 160, color: "#111827" }));
	}, [signature.strokes]);
	const showJson = React.useCallback((): void => {
		setOutput(JSON.stringify(signature.strokes));
	}, [signature.strokes]);
	return (
		<View className="gap-3">
			<SignaturePad strokes={signature.strokes} onChange={signature.onChange} />
			<View className="flex-row gap-2">
				<Button label="SVG" variant="outline" size="sm" onPress={showSvg} />
				<Button label="JSON" variant="outline" size="sm" onPress={showJson} />
			</View>
			{output === null ? null : <CodeBlock code={output} size="sm" wrap maxLines={6} />}
		</View>
	);
}
