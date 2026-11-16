"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import {
	SignaturePad,
	SignaturePadArea,
	SignaturePadClear,
	SignaturePadControls,
	SignaturePadGuide,
	SignaturePadPlaceholder,
	type SignaturePadPointerType,
} from "@workspace/ui/components/signature-pad";
import { Switch } from "@workspace/ui/components/switch";
import * as React from "react";

const INPUT_LABEL: Readonly<Record<SignaturePadPointerType, string>> = {
	pen: "Stylus, width from pressure",
	touch: "Finger, width from speed",
	mouse: "Mouse, width from speed",
};

/** A stylus reports pressure; accepting only it ignores a resting palm. */
const PEN_ONLY_POINTER_TYPES: readonly SignaturePadPointerType[] = ["pen"];

interface StrokeStartDetails {
	readonly pointerType: SignaturePadPointerType;
}

export function SignaturePad9Example(): React.JSX.Element {
	const id = React.useId();
	const [penOnly, setPenOnly] = React.useState(false);
	const [lastInput, setLastInput] = React.useState<SignaturePadPointerType | null>(null);

	const handleStrokeStart = React.useCallback(({ pointerType }: StrokeStartDetails): void => {
		setLastInput(pointerType);
	}, []);

	const handlePenOnlyChange = React.useCallback((checked: boolean): void => {
		setPenOnly(checked);
	}, []);

	return (
		<SignaturePad pointerTypes={penOnly ? PEN_ONLY_POINTER_TYPES : undefined} onStrokeStart={handleStrokeStart} className="mx-auto max-w-lg">
			<Field orientation="horizontal">
				<FieldContent>
					<FieldLabel htmlFor={`${id}-pen`}>Pen only</FieldLabel>
					<FieldDescription>Ignore touch and mouse, so a hand resting on the screen leaves no marks.</FieldDescription>
				</FieldContent>
				<Switch id={`${id}-pen`} checked={penOnly} onCheckedChange={handlePenOnlyChange} />
			</Field>
			<SignaturePadArea className="h-48">
				<SignaturePadGuide />
				<SignaturePadPlaceholder>{penOnly ? "Sign with a stylus" : "Sign with a stylus, finger or mouse"}</SignaturePadPlaceholder>
				<SignaturePadControls position="top-end">
					<SignaturePadClear variant="ghost" />
				</SignaturePadControls>
			</SignaturePadArea>
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				Last stroke
				<Badge variant="outline">{lastInput ? INPUT_LABEL[lastInput] : "None yet"}</Badge>
			</div>
		</SignaturePad>
	);
}
