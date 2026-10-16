"use client";

import * as React from "react";

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

interface Choice {
	readonly value: string;
	readonly label: string;
	readonly hint: string;
}

interface Question {
	readonly name: string;
	readonly title: string;
	readonly description: string;
	readonly choices: readonly Choice[];
}

/** Shown in the summary for a question FormData carries no answer for. */
const NOT_ANSWERED = "Not answered";

// Only the active fieldset has a layout box, because the primitive marks the
// rest hidden and inert. The card measures one question at a time, so three
// questions of similar shape are what keep it from jumping on each Next.
const QUESTIONS: readonly Question[] = [
	{
		name: "usage",
		title: "What will you use the workspace for?",
		description: "This picks the default views. Nothing here is permanent.",
		choices: [
			{
				value: "product",
				label: "Shipping product work",
				hint: "Roadmap, sprint board and release notes",
			},
			{
				value: "clients",
				label: "Running client projects",
				hint: "Separate spaces, budgets and approvals",
			},
			{
				value: "research",
				label: "Tracking research",
				hint: "Interview notes, findings and shared tags",
			},
		],
	},
	{
		name: "size",
		title: "How many people will join you?",
		description: "Seats stay flexible. This only sets a starting layout.",
		choices: [
			{ value: "solo", label: "Just me", hint: "One private space" },
			{
				value: "small",
				label: "2 to 10",
				hint: "A shared space with light roles",
			},
			{
				value: "mid",
				label: "11 to 50",
				hint: "Teams, groups and per-team defaults",
			},
		],
	},
	{
		name: "first",
		title: "What should we set up first?",
		description: "The rest can be added from the sidebar at any point.",
		choices: [
			{
				value: "board",
				label: "A project board",
				hint: "Intake, in progress and done",
			},
			{
				value: "report",
				label: "A weekly report",
				hint: "Sent every Monday to whoever you pick",
			},
			{
				value: "import",
				label: "An import from your current tool",
				hint: "Projects, people and comments come across",
			},
		],
	},
];

// The root compares items against the rendered tree and warns in development
// when a name, a required flag or a choice order drifts apart. Deriving one
// from the other is what keeps the two from ever disagreeing.
//
// The choice values are spelled out for a second reason: the letter shortcuts
// are handed out from this list, and an entry without choices leaves every
// shortcut badge unrendered even while shortcuts is set.
const ITEMS: readonly QuestionnaireItemDefinition[] = QUESTIONS.map((question: Question): QuestionnaireItemDefinition => ({
	choices: question.choices.map((choice: Choice): { value: string } => ({ value: choice.value })),
	name: question.name,
	required: true,
}));

export function Questionnaire1Example(): React.JSX.Element {
	const titleId = React.useId();
	const [summary, setSummary] = React.useState<Readonly<Record<string, string>> | null>(null);

	// FormData carries the choice value, never the label, so each answer is
	// resolved back through QUESTIONS. Echoing the raw entry would show "board"
	// where the visitor picked "A project board".
	const handleSubmit = React.useCallback((event: React.SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		const answers: Record<string, string> = {};

		for (const question of QUESTIONS) {
			const value = formData.get(question.name);
			answers[question.name] = question.choices.find((choice: Choice): boolean => choice.value === value)?.label ?? NOT_ANSWERED;
		}

		setSummary(answers);
	}, []);

	const startOver = React.useCallback((): void => {
		setSummary(null);
	}, []);

	// The finished state replaces the flow instead of firing a toast. A toast
	// lands at the edge of the page, so a visitor who just pressed Finish would
	// be left looking at a form that had not visibly changed.
	if (summary !== null) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader>
					<CardTitle>Your workspace is ready</CardTitle>
					<CardDescription>Built from the three answers below. Every one of them can be changed in settings later.</CardDescription>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-3">
						{QUESTIONS.map((question: Question): React.JSX.Element => (
							<div key={question.name} className="grid min-w-0 gap-0.5">
								<dt className="text-sm text-muted-foreground">{question.title}</dt>
								<dd className="text-sm font-medium">{summary[question.name]}</dd>
							</div>
						))}
					</dl>
				</CardContent>
				<CardFooter>
					<Button size="sm" variant="outline" onClick={startOver}>
						Start over
					</Button>
				</CardFooter>
			</Card>
		);
	}

	return (
		// Passing items lets the root size the flow before a single fieldset has
		// registered, so the header reads "Question 1 of 3" on the first paint.
		//
		// The root owns the keyboard from here: Cmd or Ctrl with Enter advances,
		// the arrow keys walk answers and questions, and the letter shortcuts
		// stand down while focus is inside a text field.
		<Questionnaire className="mx-auto w-full max-w-md" defaultItem="usage" items={ITEMS} shortcuts="letters" onSubmit={handleSubmit}>
			<Card>
				{QUESTIONS.map((question: Question): React.JSX.Element => (
					// CardHeader sits between each fieldset and its legend, which stops
					// the legend naming the group. Pairing the title id with
					// aria-labelledby on the item puts that name back.
					//
					// Nothing below pairs a description or an error by hand: the
					// primitive puts the description id into aria-describedby, and adds
					// the error id, plus role="alert", once the item goes invalid.
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
								{question.choices.map((choice: Choice): React.JSX.Element => (
									<QuestionnaireChoice key={choice.value} value={choice.value}>
										{choice.label}
										<QuestionnaireChoiceDescription>{choice.hint}</QuestionnaireChoiceDescription>
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
						<QuestionnaireSubmit>Finish setup</QuestionnaireSubmit>
					</QuestionnaireActions>
				</CardFooter>
			</Card>
		</Questionnaire>
	);
}
