"use client";

import * as React from "react";
import { CircleCheckIcon } from "lucide-react";
import { cn } from "@workspace/ui/lib/core/utils";

import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import {
	Questionnaire,
	QuestionnaireActions,
	QuestionnaireChoice,
	QuestionnaireChoices,
	QuestionnaireError,
	QuestionnaireItem,
	QuestionnaireNext,
	QuestionnairePrevious,
	QuestionnaireProgress,
	QuestionnaireSubmit,
	QuestionnaireTitle,
	type QuestionnaireItemDefinition,
	type QuestionnaireProgressRender,
} from "@workspace/ui/components/questionnaire";

interface Choice {
	readonly value: string;
	readonly label: string;
}

interface Question {
	readonly name: string;
	readonly step: string;
	readonly title: string;
	readonly choices: readonly Choice[];
}

/** The progress state counts questions from 1; the list is 0-based. */
const ONE_BASED_OFFSET = 1;

// Four questions of three choices each, none of them carrying a description,
// so every step is the same height. Inactive fieldsets are hidden and have no
// box at all, so uneven steps would make the card jump on each Next.
// Named on its own because the finished state reads its answer back.
const SOURCE_QUESTION: Question = {
	name: "source",
	step: "Source",
	title: "Where does the data come from?",
	choices: [
		{ value: "warehouse", label: "A warehouse table" },
		{ value: "stream", label: "An event stream" },
		{ value: "uploads", label: "Files uploaded by hand" },
	],
};

const QUESTIONS: readonly Question[] = [
	SOURCE_QUESTION,
	{
		name: "volume",
		step: "Volume",
		title: "How much arrives in a day?",
		choices: [
			{ value: "small", label: "Under 1M rows" },
			{ value: "medium", label: "1M to 50M rows" },
			{ value: "large", label: "More than 50M rows" },
		],
	},
	{
		name: "alerting",
		step: "Alerting",
		title: "Who should be alerted when it stalls?",
		choices: [
			{ value: "oncall", label: "The on-call rota" },
			{ value: "data", label: "The data team channel" },
			{ value: "none", label: "Nobody yet" },
		],
	},
	{
		name: "owner",
		step: "Owner",
		title: "Who owns the pipeline?",
		choices: [
			{ value: "me", label: "Me" },
			{ value: "teammate", label: "A teammate" },
			{ value: "undecided", label: "Still deciding" },
		],
	},
];

const ITEMS: readonly QuestionnaireItemDefinition[] = QUESTIONS.map((question: Question): QuestionnaireItemDefinition => ({
	name: question.name,
	required: true,
}));

// w-full on the progress part is not optional: the primitive ships w-fit with a
// min-width sized for the default "Question N of M" string, and a custom bar
// left inside that box stops well short of the questions.
//
// One string for both readings. aria-valuetext goes on after the spread because
// the props carry the primitive's own "Question N of M", and for a progressbar
// that value text is what gets announced.
const renderStepProgress: QuestionnaireProgressRender = (props, state): React.ReactElement => {
	const step = QUESTIONS.at(state.current - ONE_BASED_OFFSET)?.step ?? "";
	const label = `Step ${String(state.current)} of ${String(state.total)} - ${step}`;

	return (
		<div {...props} aria-valuetext={label}>
			<div aria-hidden="true" className="mb-2 flex gap-1.5">
				{QUESTIONS.map((question: Question, index: number): React.JSX.Element => (
					// Hidden from assistive tech because the wrapper already carries
					// role="progressbar" with aria-valuenow, so exposing the segments
					// would announce the position a second time.
					//
					// state.current is 1-based, hence the strict less-than. Every
					// question here is enabled, so one segment per question matches
					// state.total.
					<span key={question.name} className={cn("h-1.5 flex-1 rounded-full", index < state.current ? "bg-primary" : "bg-muted")} />
				))}
			</div>
			<span>{label}</span>
		</div>
	);
};

export function Questionnaire4Example(): React.JSX.Element {
	const [created, setCreated] = React.useState<string | null>(null);

	const handleSubmit = React.useCallback((event: React.SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		const answer = formData.get(SOURCE_QUESTION.name);
		const source = SOURCE_QUESTION.choices.find((choice: Choice): boolean => choice.value === answer);

		setCreated(source?.label.toLowerCase() ?? "the chosen source");
	}, []);

	const setUpAnother = React.useCallback((): void => {
		setCreated(null);
	}, []);

	if (created !== null) {
		return (
			// Empty, not a Card, for the ending. The flow itself runs bare, so a
			// panel appearing only at the finish would introduce a frame the visitor
			// had not been looking at for the previous four steps.
			<Empty className="mx-auto w-full max-w-md">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<CircleCheckIcon aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>Pipeline queued</EmptyTitle>
					<EmptyDescription>We are provisioning a pipeline from {created}. The first run starts as soon as the connection is verified.</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button size="sm" variant="outline" onClick={setUpAnother}>
						Set up another
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	return (
		<Questionnaire className="mx-auto w-full max-w-md" defaultItem="source" items={ITEMS} onSubmit={handleSubmit}>
			<QuestionnaireProgress className="w-full" render={renderStepProgress} />

			{QUESTIONS.map((question: Question): React.JSX.Element => (
				// The title renders as the fieldset's own legend with nothing between
				// the two, so the group is named without any aria-labelledby pairing.
				// A card header in between would break that and need one.
				<QuestionnaireItem key={question.name} name={question.name} required>
					<QuestionnaireTitle>{question.title}</QuestionnaireTitle>
					<QuestionnaireChoices>
						{question.choices.map((choice: Choice): React.JSX.Element => (
							<QuestionnaireChoice key={choice.value} value={choice.value}>
								{choice.label}
							</QuestionnaireChoice>
						))}
					</QuestionnaireChoices>
					<QuestionnaireError />
				</QuestionnaireItem>
			))}

			<QuestionnaireActions>
				<QuestionnairePrevious />
				<QuestionnaireNext>Next</QuestionnaireNext>
				<QuestionnaireSubmit>Create the pipeline</QuestionnaireSubmit>
			</QuestionnaireActions>
		</Questionnaire>
	);
}
