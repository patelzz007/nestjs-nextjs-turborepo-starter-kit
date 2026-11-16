import { Questionnaire, type QuestionnaireAnswers, type QuestionnaireQuestion } from "@workspace/ui-native/components/questionnaire";
import * as React from "react";
import { Text } from "react-native";

const QUESTIONS: readonly QuestionnaireQuestion[] = [
	{
		key: "share",
		title: "Will you share this project?",
		choices: [
			{ value: "yes", label: "Yes, with people" },
			{ value: "no", label: "No, just me" },
		],
	},
	{
		key: "people",
		title: "Who should get access?",
		type: "multiple",
		enabled: (answers: QuestionnaireAnswers): boolean => answers.share?.values.includes("yes") === true,
		choices: [
			{ value: "ava", label: "Ava Patel" },
			{ value: "ben", label: "Ben Ortiz" },
			{ value: "chloe", label: "Chloe Kim" },
		],
	},
	{
		key: "name",
		title: "Pick a colour",
		choices: [
			{ value: "blue", label: "Blue" },
			{ value: "green", label: "Green" },
		],
	},
	{
		key: "notify",
		title: "Send a summary each week?",
		choices: [
			{ value: "yes", label: "Yes" },
			{ value: "no", label: "No" },
		],
	},
];

const NO_ANSWERS: QuestionnaireAnswers = {};

export function Questionnaire7Example(): React.JSX.Element {
	const [answers, setAnswers] = React.useState<QuestionnaireAnswers>(NO_ANSWERS);
	const [done, setDone] = React.useState(false);
	const submit = React.useCallback((): void => {
		setDone(true);
	}, []);
	if (done) {
		return <Text className="text-body font-sans text-foreground">All set. Your workspace is ready.</Text>;
	}
	return <Questionnaire questions={QUESTIONS} answers={answers} onAnswersChange={setAnswers} onSubmit={submit} variant="card" />;
}
