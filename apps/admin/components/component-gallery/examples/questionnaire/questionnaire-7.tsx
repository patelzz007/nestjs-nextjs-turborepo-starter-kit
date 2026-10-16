"use client";

import * as React from "react";
import { RotateCcwIcon } from "lucide-react";
import { cn } from "@workspace/ui/lib/core/utils";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	Questionnaire,
	QuestionnaireActions,
	QuestionnaireChoice,
	QuestionnaireChoiceDescription,
	QuestionnaireChoices,
	QuestionnaireDescription,
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
}

interface Question {
	readonly name: string;
	readonly title: string;
	readonly description: string;
	readonly choices: readonly Option[];
}

interface Person {
	readonly value: string;
	readonly name: string;
	readonly role: string;
	readonly initials: string;
}

/** Shown in the summary for a question FormData carries no answer for. */
const NOT_ANSWERED = "Not answered";
/** No usage picked yet: the branch stays shut. */
const NO_USAGE = "";
/** The usage answers that open the owner question. */
const TEAM_USAGE = "team";
const AGENCY_USAGE = "agency";

const USAGE: readonly Option[] = [
	{ value: "solo", label: "Just me" },
	{ value: TEAM_USAGE, label: "A team inside one company" },
	{ value: AGENCY_USAGE, label: "Client work across several companies" },
];

// Sample people only. The reui original loaded stock photos from a CDN; the
// gallery makes no network requests, so each avatar shows its initials.
const OWNERS: readonly Person[] = [
	{
		value: "amara",
		name: "Amara Boateng",
		role: "Operations lead",
		initials: "AB",
	},
	{
		value: "ines",
		name: "Ines Roca",
		role: "Delivery manager",
		initials: "IR",
	},
	{
		value: "theo",
		name: "Theo Lindqvist",
		role: "Engineering manager",
		initials: "TL",
	},
	{
		value: "daniel",
		name: "Daniel Okafor",
		role: "Finance partner",
		initials: "DO",
	},
];

// Both tail questions share one shape, so they come from an array instead of
// being written out twice. The controlled question and the branch stay
// explicit below, because each needs props the other two do not.
const IMPORT_QUESTION: Question = {
	name: "import",
	title: "What should we import first?",
	description: "The rest follows once the first import has been checked.",
	choices: [
		{ value: "projects", label: "Projects and their tasks" },
		{ value: "people", label: "People and their roles" },
		{ value: "files", label: "Files and attachments" },
	],
};

const START_QUESTION: Question = {
	name: "start",
	title: "When do you want to start?",
	description: "Nothing reaches your team until you say so.",
	choices: [
		{ value: "now", label: "Right away" },
		{ value: "week", label: "Later this week" },
		{ value: "later", label: "After the team is briefed" },
	],
};

const TAIL: readonly Question[] = [IMPORT_QUESTION, START_QUESTION];

function toRequiredItem(question: Question): QuestionnaireItemDefinition {
	return { name: question.name, required: true };
}

const TAIL_ITEMS: readonly QuestionnaireItemDefinition[] = TAIL.map(toRequiredItem);

interface Summary {
	readonly usage: string;
	readonly owner: string | null;
	readonly first: string;
	readonly start: string;
}

function labelOf(options: readonly Option[], value: FormDataEntryValue | null): string {
	return options.find((option: Option): boolean => option.value === value)?.label ?? NOT_ANSWERED;
}

export function Questionnaire7Example(): React.JSX.Element {
	// CardHeader sits between each fieldset and its legend, which stops the
	// legend naming the group. Pairing these ids with aria-labelledby on each
	// item puts that name back.
	const titleId = React.useId();
	const [usage, setUsage] = React.useState(NO_USAGE);
	const [summary, setSummary] = React.useState<Summary | null>(null);

	// The root warns in development when items and the rendered tree disagree on
	// a name, a required flag or a disabled flag, so both sides of the branch
	// read from this one derived value and the tail reads from one array.
	//
	// Nothing is preselected, which is also what keeps the branch shut on the
	// first paint: usage is empty until an answer arrives, so needsOwner starts
	// false and the counter starts at three.
	//
	// The counter then reads "Question 1 of 4", because it is computed from the
	// enabled items. That number is the visible proof the branch is in the flow.
	const needsOwner = usage === TEAM_USAGE || usage === AGENCY_USAGE;
	const items = React.useMemo(
		(): readonly QuestionnaireItemDefinition[] => [{ name: "usage", required: true }, { disabled: !needsOwner, name: "owner", required: true }, ...TAIL_ITEMS],
		[needsOwner],
	);

	// A disabled fieldset drops its controls from the submission, so owner comes
	// back as null rather than an empty string. Keeping that null is what lets
	// the summary print "Not applicable" where a name would otherwise sit.
	const handleSubmit = React.useCallback((event: React.SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		const ownerValue = formData.get("owner");
		const owner = OWNERS.find((person: Person): boolean => person.value === ownerValue);

		setSummary({
			usage: labelOf(USAGE, formData.get("usage")),
			owner: owner?.name ?? null,
			first: labelOf(IMPORT_QUESTION.choices, formData.get(IMPORT_QUESTION.name)),
			start: labelOf(START_QUESTION.choices, formData.get(START_QUESTION.name)),
		});
	}, []);

	const createAnother = React.useCallback((): void => {
		setSummary(null);
	}, []);

	// A form reset restores the answers but knows nothing about host state, so
	// usage is cleared here too. Without that the branch would stay open over a
	// question whose controlling answer had just been wiped.
	const handleReset = React.useCallback((): void => {
		setUsage(NO_USAGE);
	}, []);

	const handleUsageChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setUsage(event.target.value);
	}, []);

	if (summary !== null) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader>
					<CardTitle>Workspace created</CardTitle>
					<CardDescription>The import runs in the background. You can start using the workspace before it finishes.</CardDescription>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-3">
						<div className="grid min-w-0 gap-0.5">
							<dt className="text-sm text-muted-foreground">Used for</dt>
							<dd className="text-sm font-medium">{summary.usage}</dd>
						</div>
						<div className="grid min-w-0 gap-0.5">
							<dt className="text-sm text-muted-foreground">Owner</dt>
							<dd className={cn("text-sm font-medium", summary.owner === null && "text-muted-foreground")}>{summary.owner ?? "Not applicable"}</dd>
						</div>
						<div className="grid min-w-0 gap-0.5">
							<dt className="text-sm text-muted-foreground">Importing</dt>
							<dd className="text-sm font-medium">{summary.first}</dd>
						</div>
						<div className="grid min-w-0 gap-0.5">
							<dt className="text-sm text-muted-foreground">Starting</dt>
							<dd className="text-sm font-medium">{summary.start}</dd>
						</div>
					</dl>
				</CardContent>
				<CardFooter>
					<Button size="sm" variant="outline" onClick={createAnother}>
						Create another
					</Button>
				</CardFooter>
			</Card>
		);
	}

	return (
		// Progress is repeated in every card header rather than written once above
		// the card. Only the active fieldset has a layout box, so a counter placed
		// inside one question would disappear along with it on the next step.
		<Questionnaire className="mx-auto w-full max-w-md" items={items} onReset={handleReset} onSubmit={handleSubmit}>
			<Card>
				<QuestionnaireItem aria-labelledby={`${titleId}-usage`} name="usage" required>
					<CardHeader>
						<QuestionnaireTitle id={`${titleId}-usage`} render={<CardTitle />}>
							How will your team use this?
						</QuestionnaireTitle>
						<QuestionnaireDescription render={<CardDescription />}>Shared workspaces add a question about who owns them.</QuestionnaireDescription>
						<CardAction>
							<QuestionnaireProgress />
						</CardAction>
					</CardHeader>
					<CardContent>
						<QuestionnaireChoices>
							{USAGE.map((option: Option): React.JSX.Element => (
								<QuestionnaireChoice
									key={option.value}
									// Controlling one question means controlling all of its
									// choices: each takes checked, not just the selected one. A
									// mix in one group leaves the engine with two sources of
									// truth.
									checked={usage === option.value}
									value={option.value}
									onChange={handleUsageChange}>
									{option.label}
								</QuestionnaireChoice>
							))}
						</QuestionnaireChoices>
						<QuestionnaireError />
					</CardContent>
				</QuestionnaireItem>

				<QuestionnaireItem
					aria-labelledby={`${titleId}-owner`}
					// Only an item AFTER the controlling question may be toggled.
					// Disabling the item on screen makes the root fall back to the
					// first enabled one and throws the visitor back to question one.
					disabled={!needsOwner}
					name="owner"
					required>
					<CardHeader>
						<QuestionnaireTitle id={`${titleId}-owner`} render={<CardTitle />}>
							Who should own the workspace?
						</QuestionnaireTitle>
						<QuestionnaireDescription render={<CardDescription />}>The owner manages billing and can invite everyone else.</QuestionnaireDescription>
						<CardAction>
							<QuestionnaireProgress />
						</CardAction>
					</CardHeader>
					<CardContent>
						<QuestionnaireChoices>
							{OWNERS.map((person: Person): React.JSX.Element => (
								<QuestionnaireChoice key={person.value} value={person.value}>
									<span className="flex min-w-0 items-center gap-2.5">
										<Avatar size="sm">
											<AvatarFallback>{person.initials}</AvatarFallback>
										</Avatar>
										<span className="truncate">{person.name}</span>
									</span>
									<QuestionnaireChoiceDescription>{person.role}</QuestionnaireChoiceDescription>
								</QuestionnaireChoice>
							))}
						</QuestionnaireChoices>
						<QuestionnaireError />
					</CardContent>
				</QuestionnaireItem>

				{TAIL.map((question: Question): React.JSX.Element => (
					<QuestionnaireItem key={question.name} aria-labelledby={`${titleId}-${question.name}`} name={question.name} required>
						<CardHeader>
							<QuestionnaireTitle id={`${titleId}-${question.name}`} render={<CardTitle />}>
								{question.title}
							</QuestionnaireTitle>
							<QuestionnaireDescription render={<CardDescription />}>{question.description}</QuestionnaireDescription>
							<CardAction>
								<QuestionnaireProgress />
							</CardAction>
						</CardHeader>
						<CardContent>
							<QuestionnaireChoices>
								{question.choices.map((choice: Option): React.JSX.Element => (
									<QuestionnaireChoice key={choice.value} value={choice.value}>
										{choice.label}
									</QuestionnaireChoice>
								))}
							</QuestionnaireChoices>
							<QuestionnaireError />
						</CardContent>
					</QuestionnaireItem>
				))}

				<CardFooter>
					<QuestionnaireActions className="w-full">
						<QuestionnairePrevious />
						<QuestionnaireNext>Next</QuestionnaireNext>
						<QuestionnaireSubmit>Create the workspace</QuestionnaireSubmit>
					</QuestionnaireActions>
				</CardFooter>
			</Card>

			<div
				// The reset button sits outside the Actions grid. That grid assigns
				// its three columns to Previous, Skip and Next or Submit, so an extra
				// child lands in column one and jumps to a second row once Previous
				// shows.
				className="flex justify-end">
				<Button type="reset" size="sm" variant="outline">
					<RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
					Start over
				</Button>
			</div>
		</Questionnaire>
	);
}
