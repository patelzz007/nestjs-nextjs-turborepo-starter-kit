import * as React from "react";
import { BrushCleaningIcon } from "lucide-react";
import {
	SignaturePad,
	SignaturePadArea,
	SignaturePadClear,
	SignaturePadGuide,
	SignaturePadPlaceholder,
	SignaturePadRedo,
	SignaturePadUndo,
} from "@workspace/ui/components/signature-pad";

import { ButtonGroup } from "@workspace/ui/components/button-group";
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd";

export function SignaturePad2Example(): React.JSX.Element {
	return (
		<SignaturePad className="mx-auto max-w-lg">
			<div className="flex items-center gap-3">
				<ButtonGroup aria-label="History">
					<SignaturePadUndo />
					<SignaturePadRedo />
				</ButtonGroup>
				<p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
					<KbdGroup>
						<Kbd>Ctrl</Kbd>
						<Kbd>Z</Kbd>
					</KbdGroup>
					to undo
				</p>
				<SignaturePadClear size="sm" className="ms-auto">
					<BrushCleaningIcon aria-hidden="true" />
					Clear
				</SignaturePadClear>
			</div>
			<SignaturePadArea className="h-48">
				<SignaturePadGuide />
				<SignaturePadPlaceholder>Draw your signature</SignaturePadPlaceholder>
			</SignaturePadArea>
		</SignaturePad>
	);
}
