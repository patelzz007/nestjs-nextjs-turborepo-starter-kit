"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
	SignaturePad,
	SignaturePadArea,
	SignaturePadClear,
	SignaturePadControls,
	SignaturePadGuide,
	SignaturePadPlaceholder,
	type SignaturePadStroke,
} from "@workspace/ui/components/signature-pad";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import * as React from "react";
import { z } from "zod";

const SignatureModeSchema = z.enum(["draw", "type"]);
type SignatureMode = z.infer<typeof SignatureModeSchema>;

/** A typed signature needs more than an initial. */
const MIN_TYPED_SIGNATURE_LENGTH = 2;

export function SignaturePad6Example(): React.JSX.Element {
	const id = React.useId();
	const [mode, setMode] = React.useState<SignatureMode>("draw");
	const [strokes, setStrokes] = React.useState<SignaturePadStroke[]>([]);
	const [typed, setTyped] = React.useState("");
	const [adopted, setAdopted] = React.useState<SignatureMode | null>(null);

	/* Typing is the keyboard and screen reader route to the same outcome. */
	const typedName = typed.trim();
	const ready = mode === "draw" ? strokes.length > 0 : typedName.length >= MIN_TYPED_SIGNATURE_LENGTH;

	const handleModeChange = React.useCallback((value: string | number | null): void => {
		const parsed = SignatureModeSchema.safeParse(value);
		setMode(parsed.success ? parsed.data : "draw");
	}, []);

	const handleStrokesChange = React.useCallback((next: SignaturePadStroke[]): void => {
		setStrokes(next);
		setAdopted(null);
	}, []);

	const handleTypedChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setTyped(event.target.value);
		setAdopted(null);
	}, []);

	const handleAdopt = React.useCallback((): void => {
		setAdopted(mode);
	}, [mode]);

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-4">
			<Tabs value={mode} onValueChange={handleModeChange}>
				<TabsList>
					<TabsTrigger value="draw">Draw</TabsTrigger>
					<TabsTrigger value="type">Type</TabsTrigger>
				</TabsList>
				<TabsContent value="draw">
					<SignaturePad value={strokes} onValueChange={handleStrokesChange}>
						<SignaturePadArea className="h-40">
							<SignaturePadGuide />
							<SignaturePadPlaceholder />
							<SignaturePadControls position="top-end">
								<SignaturePadClear variant="ghost" />
							</SignaturePadControls>
						</SignaturePadArea>
					</SignaturePad>
				</TabsContent>
				<TabsContent value="type">
					<div className="flex flex-col gap-3">
						<Field>
							<FieldLabel htmlFor={`${id}-typed`}>Full name</FieldLabel>
							<Input id={`${id}-typed`} value={typed} onChange={handleTypedChange} autoComplete="name" placeholder="Maya Chen" />
						</Field>
						{/* A visual echo of the input, so it stays out of the reading order. */}
						<p aria-hidden="true" className="flex h-20 items-center justify-center border-b border-dashed px-4">
							{typedName === "" ? (
								<span className="text-sm text-muted-foreground">Your typed signature appears here</span>
							) : (
								<span className="truncate font-serif text-3xl italic">{typedName}</span>
							)}
						</p>
					</div>
				</TabsContent>
			</Tabs>
			<div className="flex items-center gap-3">
				<Button disabled={!ready} onClick={handleAdopt}>
					Adopt and sign
				</Button>
				<div role="status">{adopted ? <Badge variant="success-light">{adopted === "draw" ? "Drawn" : "Typed"} signature adopted</Badge> : null}</div>
			</div>
		</div>
	);
}
