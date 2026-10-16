"use client";

import * as React from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	Questionnaire,
	QuestionnaireActions,
	QuestionnaireChoice,
	QuestionnaireChoiceDescription,
	QuestionnaireChoices,
	QuestionnaireError,
	QuestionnaireItem,
	QuestionnaireNext,
	QuestionnairePrevious,
	QuestionnaireProgress,
	QuestionnaireSubmit,
	QuestionnaireTitle,
	type QuestionnaireItemDefinition,
} from "@workspace/ui/components/questionnaire";

interface Option {
	readonly value: string;
	readonly label: string;
	readonly hint?: string;
}

/** Shown in the summary for a question FormData carries no answer for. */
const NOT_ANSWERED = "Not answered";

function toChoice(option: Option): { value: string } {
	return { value: option.value };
}

const WORKFLOWS: readonly Option[] = [
	{
		value: "digest",
		label: "Daily digest",
		hint: "One summary of yesterday, sent at 08:00",
	},
	{
		value: "releases",
		label: "Release notes",
		hint: "Posted to the channel whenever a version ships",
	},
	{
		value: "incidents",
		label: "Incident alerts",
		hint: "Raised the moment a service starts degrading",
	},
	{
		value: "rollup",
		label: "Weekly roll-up",
		hint: "Team activity, every Friday afternoon",
	},
	{
		value: "billing",
		label: "Billing reminders",
		hint: "Three working days before an invoice falls due",
	},
	{
		value: "access",
		label: "Access reviews",
		hint: "A quarterly check on who can see what",
	},
];

const REVIEWERS: readonly Option[] = [
	{ value: "author", label: "Whoever wrote the change" },
	{ value: "lead", label: "A named team lead" },
	{ value: "rota", label: "The reviewer on rota that week" },
];

const CADENCES: readonly Option[] = [
	{ value: "daily", label: "Every weekday morning" },
	{ value: "weekly", label: "Once a week" },
	{ value: "monthly", label: "Once a month" },
];

// Every entry spells out its choice values because the letter shortcuts are
// handed out from this list. An items entry without choices leaves each
// shortcut badge unrendered even while shortcuts is set on the root.
//
// required on a multiple item means at least one box, not all of them. The
// primitive keeps the attribute off the individual inputs in that case, since
// a native required checkbox would insist on that one box in particular.
const ITEMS: readonly QuestionnaireItemDefinition[] = [
	{
		choices: WORKFLOWS.map(toChoice),
		name: "workflows",
		required: true,
	},
	{
		choices: REVIEWERS.map(toChoice),
		name: "reviewer",
		required: true,
	},
	{
		choices: CADENCES.map(toChoice),
		name: "cadence",
		required: true,
	},
];

interface Result {
	readonly workflows: readonly string[];
	readonly reviewer: string;
	readonly cadence: string;
}

function labelOf(options: readonly Option[], value: FormDataEntryValue | null): string {
	return options.find((option: Option): boolean => option.value === value)?.label ?? NOT_ANSWERED;
}

export function Questionnaire2Example(): React.JSX.Element {
	// The running count lives in host state because item status only reports
	// answered, unanswered or skipped. Nothing the primitive exposes counts how
	// many answers are currently ticked.
	const [selected, setSelected] = React.useState<readonly string[]>([]);
	const [result, setResult] = React.useState<Result | null>(null);

	// getAll is the counterpart to get. A multiple item writes one FormData
	// entry per checked value, so the answer stays a real string array instead
	// of arriving as one joined string that would have to be split back apart.
	//
	// Submit re-checks every enabled item, not only the last one, and jumps back
	// to the first that fails, so this handler is only reached once all three
	// questions hold an answer.
	const handleSubmit = React.useCallback((event: React.SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		const values = formData.getAll("workflows");

		setResult({
			workflows: WORKFLOWS.filter((workflow: Option): boolean => values.includes(workflow.value)).map((workflow: Option): string => workflow.label),
			reviewer: labelOf(REVIEWERS, formData.get("reviewer")),
			cadence: labelOf(CADENCES, formData.get("cadence")),
		});
	}, []);

	// One handler for every box: the input reports its own value and checked
	// state, so no per-choice closure is needed.
	const handleWorkflowChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		const { checked, value } = event.target;
		setSelected((current: readonly string[]): readonly string[] => (checked ? [...current, value] : current.filter((entry: string): boolean => entry !== value)));
	}, []);

	// The flow unmounts while the summary is on screen, so the running count has
	// to be cleared alongside it. Leaving it would reopen an empty question
	// under a badge still claiming three workflows were picked.
	const startOver = React.useCallback((): void => {
		setResult(null);
		setSelected([]);
	}, []);

	if (result !== null) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader>
					<CardTitle>Notifications switched on</CardTitle>
					<CardDescription>
						{String(result.workflows.length)} of {String(WORKFLOWS.length)} workflows will start sending from tomorrow.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-3">
						<div className="flex flex-wrap gap-1.5">
							{result.workflows.map((workflow: string): React.JSX.Element => (
								<Badge key={workflow} variant="secondary">
									{workflow}
								</Badge>
							))}
						</div>
						<p className="text-sm text-muted-foreground">
							Reviewed by {result.reviewer.toLowerCase()}, delivered {result.cadence.toLowerCase()}.
						</p>
					</div>
				</CardContent>
				<CardFooter>
					<Button size="sm" variant="outline" onClick={startOver}>
						Change answers
					</Button>
				</CardFooter>
			</Card>
		);
	}

	return (
		// No Card on this one: the root already lays its children out in a column
		// with a gap, and a bare flow reads as a different surface to its
		// neighbours.
		//
		// The progress line below carries role="progressbar" and announces itself
		// politely on each step, so the badge beside it needs no live region.
		<Questionnaire className="mx-auto w-full max-w-md" defaultItem="workflows" items={ITEMS} shortcuts="letters" onSubmit={handleSubmit}>
			<div className="flex items-center justify-between gap-2">
				<QuestionnaireProgress />
				<Badge variant="primary-light">
					{String(selected.length)} of {String(WORKFLOWS.length)} selected
				</Badge>
			</div>

			<QuestionnaireItem name="workflows" multiple required>
				<QuestionnaireTitle>Which workflows should we switch on?</QuestionnaireTitle>
				<QuestionnaireChoices>
					{WORKFLOWS.map((workflow: Option): React.JSX.Element => (
						// multiple on the item is the entire switch for checkboxes. The
						// indicator swaps on the choice's own data-type attribute, so this
						// markup is byte for byte what a single-answer question uses.
						<QuestionnaireChoice key={workflow.value} value={workflow.value} onChange={handleWorkflowChange}>
							{workflow.label}
							<QuestionnaireChoiceDescription>{workflow.hint}</QuestionnaireChoiceDescription>
						</QuestionnaireChoice>
					))}
				</QuestionnaireChoices>
				<QuestionnaireError />
			</QuestionnaireItem>

			<QuestionnaireItem name="reviewer" required>
				<QuestionnaireTitle>Who reviews changes before they ship?</QuestionnaireTitle>
				<QuestionnaireChoices>
					{REVIEWERS.map((reviewer: Option): React.JSX.Element => (
						<QuestionnaireChoice key={reviewer.value} value={reviewer.value}>
							{reviewer.label}
						</QuestionnaireChoice>
					))}
				</QuestionnaireChoices>
				<QuestionnaireError />
			</QuestionnaireItem>

			<QuestionnaireItem name="cadence" required>
				<QuestionnaireTitle>How often should the digest arrive?</QuestionnaireTitle>
				<QuestionnaireChoices>
					{CADENCES.map((cadence: Option): React.JSX.Element => (
						<QuestionnaireChoice key={cadence.value} value={cadence.value}>
							{cadence.label}
						</QuestionnaireChoice>
					))}
				</QuestionnaireChoices>
				<QuestionnaireError />
			</QuestionnaireItem>

			<QuestionnaireActions>
				<QuestionnairePrevious />
				<QuestionnaireNext>Next</QuestionnaireNext>
				<QuestionnaireSubmit>Turn these on</QuestionnaireSubmit>
			</QuestionnaireActions>
		</Questionnaire>
	);
}
