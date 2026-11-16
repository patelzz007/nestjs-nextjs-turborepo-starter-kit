import * as React from "react";
import { SignaturePad, SignaturePadArea, SignaturePadClear, SignaturePadControls, SignaturePadPlaceholder, SignaturePadUndo } from "@workspace/ui/components/signature-pad";

export function SignaturePadDo1Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-md">
			<SignaturePad>
				<SignaturePadArea variant="muted" className="h-48">
					<SignaturePadPlaceholder />
					<SignaturePadControls position="bottom-end">
						<SignaturePadUndo />
						<SignaturePadClear />
					</SignaturePadControls>
				</SignaturePadArea>
			</SignaturePad>
		</div>
	);
}
