"use client";

import { Button } from "@workspace/ui/components/button";
import {
	SignaturePad,
	SignaturePadArea,
	SignaturePadGuide,
	SignaturePadPlaceholder,
	type SignaturePadApi,
	type SignaturePadStroke,
} from "@workspace/ui/components/signature-pad";
import * as React from "react";

import { formatKilobytes } from "@/components/component-gallery/examples/signature-pad/signature-pad-example-helpers";

/** Raster pixels per CSS pixel in the uploaded PNG, so it prints sharp. */
const UPLOAD_SCALE = 3;
const UPLOAD_FILE_NAME = "signature.png";
const UPLOAD_MIME_TYPE = "image/png";

interface PreparedUpload {
	readonly name: string;
	readonly size: number;
}

export function SignaturePad12Example(): React.JSX.Element {
	/* `apiRef` reaches the pad from code outside its tree, such as a form
	   library's submit handler. */
	const padRef = React.useRef<SignaturePadApi>(null);
	const [upload, setUpload] = React.useState<PreparedUpload | null>(null);
	const [empty, setEmpty] = React.useState(true);

	const prepareUpload = React.useCallback(async (): Promise<void> => {
		const blob = await padRef.current?.toBlob({ scale: UPLOAD_SCALE });
		if (!blob) return;
		const file = new File([blob], UPLOAD_FILE_NAME, { type: UPLOAD_MIME_TYPE });
		/* Append `file` to a FormData and POST it to your own endpoint. */
		setUpload({ name: file.name, size: file.size });
	}, []);

	const handleAttach = React.useCallback((): void => {
		void prepareUpload();
	}, [prepareUpload]);

	const handleValueChange = React.useCallback((strokes: SignaturePadStroke[]): void => {
		setEmpty(strokes.length === 0);
		setUpload(null);
	}, []);

	const handleClear = React.useCallback((): void => {
		padRef.current?.clear();
		/* This button disables itself, so focus moves to the pad. */
		padRef.current?.focus();
	}, []);

	return (
		<div className="mx-auto flex w-full max-w-lg flex-col gap-3">
			<SignaturePad apiRef={padRef} onValueChange={handleValueChange}>
				<SignaturePadArea className="h-44">
					<SignaturePadGuide />
					<SignaturePadPlaceholder />
				</SignaturePadArea>
			</SignaturePad>
			<div className="flex items-center gap-2">
				<Button disabled={empty} onClick={handleAttach}>
					Attach as PNG
				</Button>
				<Button variant="ghost" disabled={empty} onClick={handleClear}>
					Clear
				</Button>
				<p role="status" className="ms-auto truncate text-sm text-muted-foreground">
					{upload ? `${upload.name}, ${formatKilobytes(upload.size)}` : null}
				</p>
			</div>
		</div>
	);
}
