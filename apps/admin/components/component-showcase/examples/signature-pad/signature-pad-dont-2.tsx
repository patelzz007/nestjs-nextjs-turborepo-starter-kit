import * as React from "react";
import { SignaturePad, SignaturePadArea, SignaturePadClear, SignaturePadControls } from "@workspace/ui/components/signature-pad";

export function SignaturePadDont2Example(): React.JSX.Element {
	return (
		<div className="w-40">
			<SignaturePad>
				<SignaturePadArea variant="muted" className="h-12">
					<SignaturePadControls position="bottom-end">
						<SignaturePadClear />
					</SignaturePadControls>
				</SignaturePadArea>
			</SignaturePad>
		</div>
	);
}
