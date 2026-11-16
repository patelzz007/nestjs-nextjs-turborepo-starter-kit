import { Attachment } from "@workspace/ui-native/components/attachment";
import { Button } from "@workspace/ui-native/components/button";
import { isSignatureEmpty, SignaturePad, signatureToSvg, useSignatureHistory } from "@workspace/ui-native/components/signature-pad";
import * as React from "react";
import { View } from "react-native";
import { formatFileSize } from "@workspace/ui-native/lib/use-file-upload";

export function SignaturePad12Example(): React.JSX.Element {
	const signature = useSignatureHistory();
	const [attached, setAttached] = React.useState<number | null>(null);
	// The upload gets the SVG document; here its size stands in for the request.
	const attach = React.useCallback((): void => {
		setAttached(signatureToSvg(signature.strokes, { width: 600, height: 200, color: "#111827" }).length);
	}, [signature.strokes]);
	return (
		<View className="gap-3">
			<SignaturePad strokes={signature.strokes} onChange={signature.onChange} />
			<View className="flex-row gap-2">
				<Button label="Clear" variant="ghost" onPress={signature.clear} />
				<Button label="Attach" disabled={isSignatureEmpty(signature.strokes)} onPress={attach} className="flex-1" />
			</View>
			{attached === null ? null : <Attachment name="signature.svg" description={formatFileSize(attached)} />}
		</View>
	);
}
