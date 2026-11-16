import { SignaturePad, useSignatureHistory } from "@workspace/ui-native/components/signature-pad";
import * as React from "react";

export function SignaturePadDont2Example(): React.JSX.Element {
	const signature = useSignatureHistory();
	return <SignaturePad strokes={signature.strokes} onChange={signature.onChange} size="sm" className="w-32" />;
}
