"use client";

import {
	SignaturePad,
	SignaturePadArea,
	SignaturePadClear,
	SignaturePadControls,
	SignaturePadPlaceholder,
	SignaturePadPreview,
	SignaturePadSave,
	type SignaturePadStroke,
} from "@workspace/ui/components/signature-pad";
import * as React from "react";

export function SignaturePad1Example(): React.JSX.Element {
	const [saved, setSaved] = React.useState<SignaturePadStroke[]>([]);

	const handleSave = React.useCallback((_value: string, strokes: SignaturePadStroke[]): void => {
		setSaved(strokes);
	}, []);

	return (
		<div className="mx-auto flex w-full max-w-lg flex-col gap-3">
			<SignaturePad>
				<SignaturePadArea variant="muted" className="h-60">
					<SignaturePadPlaceholder />
					<SignaturePadControls position="bottom-end">
						<SignaturePadClear />
						<SignaturePadSave format="json" onSave={handleSave} />
					</SignaturePadControls>
				</SignaturePadArea>
			</SignaturePad>
			<div role="status">
				{saved.length > 0 ? (
					<div className="flex items-center gap-3 text-sm text-muted-foreground">
						Saved
						<SignaturePadPreview strokes={saved} className="h-8 w-auto" />
					</div>
				) : null}
			</div>
		</div>
	);
}
