import * as React from "react";
import { SignaturePad, SignaturePadArea, SignaturePadPlaceholder } from "@workspace/ui/components/signature-pad";

export function SignaturePadDont1Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-md">
			<SignaturePad>
				<SignaturePadArea variant="muted" className="h-48">
					<SignaturePadPlaceholder />
				</SignaturePadArea>
			</SignaturePad>
		</div>
	);
}
