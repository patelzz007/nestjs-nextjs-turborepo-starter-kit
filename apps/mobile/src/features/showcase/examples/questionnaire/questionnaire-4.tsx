import { EmptyState } from "@workspace/ui-native/components/empty";
import { Questionnaire, type QuestionnaireAnswers, type QuestionnaireQuestion } from "@workspace/ui-native/components/questionnaire";
import * as React from "react";

const QUESTIONS: readonly QuestionnaireQuestion[] = [
	{
		key: "use",
		step: "Purpose",
		title: "What will you use the workspace for?",
		choices: [
			{ value: "product", label: "Building a product", hint: "Roadmaps, specs and releases" },
			{ value: "client", label: "Client work", hint: "Projects for several clients" },
			{ value: "personal", label: "Personal projects", hint: "Just for me" },
		],
	},
	{
		key: "size",
		step: "Team",
		title: "How many people will join?",
		choices: [
			{ value: "1", label: "Just me" },
			{ value: "2-10", label: "2 to 10" },
			{ value: "11+", label: "11 or more" },
		],
	},
	{
		key: "start",
		step: "Start",
		title: "Where would you like to start?",
		choices: [
			{ value: "template", label: "From a template" },
			{ value: "blank", label: "From scratch" },
		],
	},
];

const NO_ANSWERS: QuestionnaireAnswers = {};

export function Questionnaire4Example(): React.JSX.Element {
	const [answers, setAnswers] = React.useState<QuestionnaireAnswers>(NO_ANSWERS);
	const [done, setDone] = React.useState(false);
	const submit = React.useCallback((): void => {
		setDone(true);
	}, []);
	if (done) {
		return <EmptyState message="You are all set. Your workspace is ready." />;
	}
	return <Questionnaire questions={QUESTIONS} answers={answers} onAnswersChange={setAnswers} onSubmit={submit} progress="segments" />;
}
