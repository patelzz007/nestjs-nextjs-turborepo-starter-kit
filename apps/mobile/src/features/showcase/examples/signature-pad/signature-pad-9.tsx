import { Badge } from "@workspace/ui-native/components/badge";
import { SignaturePad, useSignatureHistory } from "@workspace/ui-native/components/signature-pad";
import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";
import { View } from "react-native";

export function SignaturePad9Example(): React.JSX.Element {
	const signature = useSignatureHistory();
	const [lock, setLock] = React.useState<boolean>(true);
	const [drawing, setDrawing] = React.useState<boolean>(false);
	return (
		<View className="gap-3">
			<Switch label="Lock the page while signing" description="Stops the screen scrolling under the pen." checked={lock} onChange={setLock} />
			<SignaturePad strokes={signature.strokes} onChange={signature.onChange} onDrawingChange={setDrawing} />
			<Badge label={drawing ? "Signing…" : "Ready"} tone={drawing ? "info" : "neutral"} size="sm" />
		</View>
	);
}
