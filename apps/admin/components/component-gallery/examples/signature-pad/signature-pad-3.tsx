"use client";

import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { SignaturePad, SignaturePadArea, SignaturePadGuide } from "@workspace/ui/components/signature-pad";
import * as React from "react";
import { z } from "zod";

import { encodedSize, formatKilobytes } from "@/components/component-gallery/examples/signature-pad/signature-pad-example-helpers";

/** Shown when the signer leaves the name blank. */
const UNNAMED_SIGNER = "Unnamed signer";

/**
 * The submitted form, read at the boundary. The pad writes an SVG data URL
 * into the form under its `name`; a field that is missing (or a file, which
 * these fields never are) reads as empty.
 */
const SignatureFormSchema = z.object({
	name: z.string().catch(""),
	signature: z.string().catch(""),
});

interface SubmittedSignature {
	readonly name: string;
	readonly size: number;
}

export function SignaturePad3Example(): React.JSX.Element {
	const id = React.useId();
	const [invalid, setInvalid] = React.useState(false);
	const [submitted, setSubmitted] = React.useState<SubmittedSignature | null>(null);

	const handleSubmit = React.useCallback((event: React.SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const { name, signature } = SignatureFormSchema.parse({ name: data.get("name"), signature: data.get("signature") });
		const signed = signature !== "";
		setInvalid(!signed);
		setSubmitted(signed ? { name: name.trim() === "" ? UNNAMED_SIGNER : name.trim(), size: encodedSize(signature) } : null);
	}, []);

	const handleReset = React.useCallback((): void => {
		setInvalid(false);
		setSubmitted(null);
	}, []);

	const handleStrokeStart = React.useCallback((): void => {
		setInvalid(false);
	}, []);

	return (
		<form noValidate className="mx-auto w-full max-w-md" onSubmit={handleSubmit} onReset={handleReset}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={`${id}-name`}>Full name</FieldLabel>
					<Input id={`${id}-name`} name="name" autoComplete="name" placeholder="Maya Chen" />
				</Field>
				<Field data-invalid={invalid || undefined}>
					<FieldLabel id={`${id}-label`}>Signature</FieldLabel>
					<SignaturePad name="signature" format="svg" required onStrokeStart={handleStrokeStart}>
						<SignaturePadArea aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} aria-invalid={invalid || undefined}>
							<SignaturePadGuide />
						</SignaturePadArea>
					</SignaturePad>
					{invalid ? (
						<FieldError id={`${id}-hint`}>Sign above to continue.</FieldError>
					) : (
						<FieldDescription id={`${id}-hint`}>Use a mouse, a finger or a stylus.</FieldDescription>
					)}
				</Field>
				<div className="flex items-center gap-2">
					<Button type="submit">Submit</Button>
					<Button type="reset" variant="outline">
						Reset
					</Button>
					<p role="status" className="ms-auto min-w-0 truncate text-sm text-muted-foreground">
						{submitted ? `Signed by ${submitted.name}, ${formatKilobytes(submitted.size)} SVG` : null}
					</p>
				</div>
			</FieldGroup>
		</form>
	);
}
