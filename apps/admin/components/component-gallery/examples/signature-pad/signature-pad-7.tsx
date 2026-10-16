"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import {
	SignaturePad,
	SignaturePadArea,
	SignaturePadClear,
	SignaturePadControls,
	SignaturePadGuide,
	SignaturePadPlaceholder,
	type SignaturePadApi,
	type SignaturePadStroke,
} from "@workspace/ui/components/signature-pad";
import * as React from "react";

import { focusOnMount } from "@/components/component-gallery/examples/signature-pad/signature-pad-example-helpers";

const SIGNED_AT_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function SignaturePad7Example(): React.JSX.Element {
	const id = React.useId();
	const [strokes, setStrokes] = React.useState<SignaturePadStroke[]>([]);
	const [agreed, setAgreed] = React.useState(false);
	const [signedAt, setSignedAt] = React.useState<string | null>(null);
	const padRef = React.useRef<SignaturePadApi>(null);

	const handleStartOver = React.useCallback((): void => {
		setSignedAt(null);
		setStrokes([]);
		setAgreed(false);
		/* The pad leaves read-only on the next render; focus it once it has. */
		requestAnimationFrame((): void => {
			padRef.current?.focus();
		});
	}, []);

	const handleAgreedChange = React.useCallback((checked: boolean): void => {
		setAgreed(checked);
	}, []);

	const handleSign = React.useCallback((): void => {
		setSignedAt(SIGNED_AT_FORMAT.format(new Date()));
	}, []);

	return (
		<Card className="mx-auto w-full max-w-md">
			<CardHeader>
				<CardTitle>Service agreement</CardTitle>
				<CardDescription>Northwind Studio, 12-month retainer</CardDescription>
				<CardAction>
					{/* Up here, away from Sign agreement, so a double click on it
					    cannot land on Start over and wipe what was just signed. */}
					<div className="flex items-center gap-2">
						{signedAt ? (
							<Button variant="ghost" size="xs" onClick={handleStartOver}>
								Start over
							</Button>
						) : null}
						<Badge variant={signedAt ? "success-light" : "warning-light"}>{signedAt ? "Signed" : "Awaiting signature"}</Badge>
					</div>
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-4">
					<p className="text-sm text-muted-foreground">By signing you accept the scope, the payment schedule and the 30-day notice period in sections 2 to 5.</p>
					<SignaturePad apiRef={padRef} value={strokes} onValueChange={setStrokes} readOnly={signedAt !== null}>
						<SignaturePadArea aria-label="Client signature" className="h-36">
							<SignaturePadGuide />
							<SignaturePadPlaceholder />
							{signedAt === null ? (
								<SignaturePadControls position="top-end">
									<SignaturePadClear variant="ghost" />
								</SignaturePadControls>
							) : null}
						</SignaturePadArea>
						<div className="flex justify-between text-xs text-muted-foreground">
							<span>Maya Chen, Client</span>
							<span>{signedAt ?? "Dated on signing"}</span>
						</div>
					</SignaturePad>
					<Field orientation="horizontal">
						<Checkbox id={`${id}-agree`} checked={agreed} disabled={signedAt !== null} onCheckedChange={handleAgreedChange} />
						<FieldLabel htmlFor={`${id}-agree`}>I have read and agree to the agreement</FieldLabel>
					</Field>
				</div>
			</CardContent>
			<CardFooter>
				{signedAt ? (
					<p ref={focusOnMount} tabIndex={-1} role="status" className="w-full text-center text-sm font-medium outline-none">
						Agreement signed
					</p>
				) : (
					<Button className="w-full" disabled={!agreed || strokes.length === 0} onClick={handleSign}>
						Sign agreement
					</Button>
				)}
			</CardFooter>
		</Card>
	);
}
