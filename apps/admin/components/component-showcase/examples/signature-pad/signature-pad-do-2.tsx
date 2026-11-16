import * as React from "react";
import { SignaturePad, SignaturePadArea, SignaturePadClear, SignaturePadControls, SignaturePadPlaceholder } from "@workspace/ui/components/signature-pad";

export function SignaturePadDo2Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-md">
			<SignaturePad>
				<SignaturePadArea variant="muted" className="h-48">
					<SignaturePadPlaceholder />
					<SignaturePadControls position="bottom-end">
						<SignaturePadClear />
					</SignaturePadControls>
				</SignaturePadArea>
			</SignaturePad>
		</div>
	);
}
