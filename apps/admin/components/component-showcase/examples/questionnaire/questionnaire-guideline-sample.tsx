"use client";

// The questionnaire the Do / Don't pairs show: one card, one question at a time, from a plain list of questions.

import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	Questionnaire,
	QuestionnaireActions,
	QuestionnaireChoice,
	QuestionnaireChoices,
	QuestionnaireDescription,
	QuestionnaireError,
	QuestionnaireItem,
	QuestionnaireNext,
	QuestionnairePrevious,
	QuestionnaireProgress,
	QuestionnaireSkip,
	QuestionnaireSubmit,
	QuestionnaireTitle,
	type QuestionnaireItemDefinition,
} from "@workspace/ui/components/questionnaire";
import * as React from "react";

/** One choice: what is stored and what people read. */
export interface GuidelineChoice {
	readonly value: string;
	readonly label: string;
}

/** One question of the sample. */
export interface GuidelineQuestion {
	readonly name: string;
	readonly title: string;
	readonly description?: string | undefined;
	readonly required: boolean;
	readonly choices: readonly GuidelineChoice[];
}

function preventSubmit(event: React.SubmitEvent<HTMLFormElement>): void {
	event.preventDefault();
}

export function GuidelineQuestionnaire({ questions }: { readonly questions: readonly GuidelineQuestion[] }): React.JSX.Element {
	const titleId = React.useId();
	const items = React.useMemo(
		(): readonly QuestionnaireItemDefinition[] => questions.map(({ name, required }: GuidelineQuestion): QuestionnaireItemDefinition => ({ name, required })),
		[questions],
	);
	const [first] = questions;
	return (
		<Questionnaire className="w-full max-w-md" defaultItem={first?.name ?? ""} items={items} onSubmit={preventSubmit}>
			<Card>
				{questions.map((question: GuidelineQuestion): React.JSX.Element => (
					<QuestionnaireItem key={question.name} aria-labelledby={`${titleId}-${question.name}`} name={question.name} required={question.required}>
						<CardHeader>
							<QuestionnaireTitle id={`${titleId}-${question.name}`} render={<CardTitle />}>
								{question.title}
							</QuestionnaireTitle>
							{question.description === undefined ? null : <QuestionnaireDescription render={<CardDescription />}>{question.description}</QuestionnaireDescription>}
							<CardAction>
								<QuestionnaireProgress />
							</CardAction>
						</CardHeader>
						<CardContent>
							<QuestionnaireChoices>
								{question.choices.map((choice: GuidelineChoice): React.JSX.Element => (
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
						<QuestionnaireSkip>Skip</QuestionnaireSkip>
						<QuestionnaireNext>Next</QuestionnaireNext>
						<QuestionnaireSubmit>Send answers</QuestionnaireSubmit>
					</QuestionnaireActions>
				</CardFooter>
			</Card>
		</Questionnaire>
	);
}
