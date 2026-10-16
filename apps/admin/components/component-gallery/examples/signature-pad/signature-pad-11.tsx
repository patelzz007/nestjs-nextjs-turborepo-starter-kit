"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
	SignaturePad,
	SignaturePadArea,
	SignaturePadClear,
	SignaturePadControls,
	SignaturePadGuide,
	SignaturePadPlaceholder,
	SignaturePadUndo,
	type SignaturePadStroke,
} from "@workspace/ui/components/signature-pad";
import * as React from "react";

import { focusOnMount } from "@/components/component-gallery/examples/signature-pad/signature-pad-example-helpers";

export function SignaturePad11Example(): React.JSX.Element {
	const id = React.useId();
	const [recipient, setRecipient] = React.useState("");
	const [strokes, setStrokes] = React.useState<SignaturePadStroke[]>([]);
	const [confirmed, setConfirmed] = React.useState(false);
	const recipientName = recipient.trim();

	const handleRecipientChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setRecipient(event.target.value);
	}, []);

	const handleConfirm = React.useCallback((): void => {
		setConfirmed(true);
	}, []);

	return (
		<Card className="mx-auto w-full max-w-sm">
			<CardHeader>
				<CardTitle>Proof of delivery</CardTitle>
				<CardDescription>
					<span className="flex items-center gap-2">
						Order #48213
						<span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />3 parcels
					</span>
				</CardDescription>
				{confirmed ? (
					<CardAction>
						<Badge variant="success-light">Delivered</Badge>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-4">
					<Field>
						<FieldLabel htmlFor={`${id}-recipient`}>Received by</FieldLabel>
						<Input id={`${id}-recipient`} value={recipient} disabled={confirmed} onChange={handleRecipientChange} placeholder="Recipient name" autoComplete="off" />
					</Field>
					<Field>
						<FieldLabel id={`${id}-signature`}>Recipient signature</FieldLabel>
						{/* The area blocks page scroll under a finger, so the recipient can sign on a phone. */}
						<SignaturePad value={strokes} onValueChange={setStrokes} readOnly={confirmed}>
							<SignaturePadArea aria-labelledby={`${id}-signature`} className="h-44">
								<SignaturePadGuide />
								<SignaturePadPlaceholder>Hand the device to the recipient</SignaturePadPlaceholder>
								{confirmed ? null : (
									<SignaturePadControls position="top-end">
										<SignaturePadUndo variant="ghost" />
										<SignaturePadClear variant="ghost" />
									</SignaturePadControls>
								)}
							</SignaturePadArea>
						</SignaturePad>
					</Field>
				</div>
			</CardContent>
			<CardFooter>
				{confirmed ? (
					<p ref={focusOnMount} tabIndex={-1} role="status" className="w-full text-center text-sm font-medium outline-none">
						Delivered to {recipientName}
					</p>
				) : (
					<Button size="lg" className="w-full" disabled={recipientName === "" || strokes.length === 0} onClick={handleConfirm}>
						Confirm delivery
					</Button>
				)}
			</CardFooter>
		</Card>
	);
}
