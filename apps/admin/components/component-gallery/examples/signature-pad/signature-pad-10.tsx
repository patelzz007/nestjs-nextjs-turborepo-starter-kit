"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
import {
	SignaturePad,
	SignaturePadArea,
	SignaturePadClear,
	SignaturePadControls,
	SignaturePadPlaceholder,
	type SignaturePadStroke,
} from "@workspace/ui/components/signature-pad";
import { CircleCheckIcon, CircleDashedIcon } from "lucide-react";
import * as React from "react";

import { focusOnMount } from "@/components/component-gallery/examples/signature-pad/signature-pad-example-helpers";

interface Clause {
	readonly id: string;
	/** The section number in the agreement. */
	readonly number: number;
	readonly title: string;
	readonly description: string;
}

const CLAUSES: readonly Clause[] = [
	{ id: "scope", number: 2, title: "Scope of work", description: "Design and build of the marketing site, 6 templates." },
	{ id: "payment", number: 3, title: "Payment terms", description: "Invoiced monthly in arrears, due within 30 days." },
	{ id: "ownership", number: 4, title: "Ownership", description: "Source files transfer to the client on final payment." },
	{ id: "termination", number: 5, title: "Termination", description: "Either party, with 30 days written notice." },
];

/** Initials are small, so the line range is narrower than a full signature's. */
const INITIALS_MIN_LINE_WIDTH = 0.6;
const INITIALS_MAX_LINE_WIDTH = 2.4;

interface ClauseRowProps {
	readonly clause: Clause;
	readonly done: boolean;
	readonly submitted: boolean;
	readonly onInitialedChange: (clauseId: string, initialed: boolean) => void;
}

function ClauseRow({ clause, done, submitted, onInitialedChange }: ClauseRowProps): React.JSX.Element {
	const handleValueChange = React.useCallback(
		(strokes: SignaturePadStroke[]): void => {
			onInitialedChange(clause.id, strokes.length > 0);
		},
		[clause.id, onInitialedChange],
	);

	return (
		<Item variant="outline" size="sm">
			<ItemMedia variant="icon" aria-hidden="true">
				{done ? <CircleCheckIcon className="text-success" /> : <CircleDashedIcon className="text-muted-foreground" />}
			</ItemMedia>
			<ItemContent>
				<ItemTitle>
					{clause.number}. {clause.title}
					{done ? <span className="sr-only">, initialed</span> : null}
				</ItemTitle>
				<ItemDescription>{clause.description}</ItemDescription>
			</ItemContent>
			<ItemActions>
				<SignaturePad minWidth={INITIALS_MIN_LINE_WIDTH} maxWidth={INITIALS_MAX_LINE_WIDTH} readOnly={submitted} className="w-28" onValueChange={handleValueChange}>
					<SignaturePadArea variant="muted" aria-label={`Initials for ${clause.title}`} className="h-14">
						<SignaturePadPlaceholder>Initials</SignaturePadPlaceholder>
						{done && !submitted ? (
							<SignaturePadControls className="end-1 top-1">
								<SignaturePadClear variant="ghost" size="icon-xs" />
							</SignaturePadControls>
						) : null}
					</SignaturePadArea>
				</SignaturePad>
			</ItemActions>
		</Item>
	);
}

export function SignaturePad10Example(): React.JSX.Element {
	const [initialed, setInitialed] = React.useState<ReadonlySet<string>>(new Set<string>());
	const [submitted, setSubmitted] = React.useState(false);
	const count = CLAUSES.filter((clause: Clause): boolean => initialed.has(clause.id)).length;
	const complete = count === CLAUSES.length;

	const handleInitialedChange = React.useCallback((clauseId: string, isInitialed: boolean): void => {
		setInitialed((current: ReadonlySet<string>): ReadonlySet<string> => {
			const next = new Set(current);
			if (isInitialed) {
				next.add(clauseId);
			} else {
				next.delete(clauseId);
			}
			return next;
		});
	}, []);

	const handleSubmit = React.useCallback((): void => {
		setSubmitted(true);
	}, []);

	return (
		<div className="mx-auto flex w-full max-w-lg flex-col gap-3">
			<div className="flex items-start justify-between gap-4">
				<div className="flex flex-col gap-0.5">
					<p className="text-sm font-medium">Initial each clause</p>
					<p className="text-xs text-muted-foreground">Your initials confirm you have read the section.</p>
				</div>
				<Badge variant={complete ? "success-light" : "secondary"}>
					{count} of {CLAUSES.length} initialed
				</Badge>
			</div>
			<ItemGroup>
				{CLAUSES.map((clause: Clause): React.JSX.Element => (
					<ClauseRow key={clause.id} clause={clause} done={initialed.has(clause.id)} submitted={submitted} onInitialedChange={handleInitialedChange} />
				))}
			</ItemGroup>
			{submitted ? (
				<p ref={focusOnMount} tabIndex={-1} role="status" className="self-end text-sm font-medium outline-none">
					Initials submitted
				</p>
			) : (
				<Button disabled={!complete} onClick={handleSubmit} className="self-end">
					Submit initials
				</Button>
			)}
		</div>
	);
}
