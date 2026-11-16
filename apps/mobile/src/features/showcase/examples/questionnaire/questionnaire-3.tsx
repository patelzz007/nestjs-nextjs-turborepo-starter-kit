import { Questionnaire, type QuestionnaireAnswers, type QuestionnaireQuestion } from "@workspace/ui-native/components/questionnaire";
import * as React from "react";
import { Text } from "react-native";

const QUESTIONS: readonly QuestionnaireQuestion[] = [
	{
		key: "heard",
		title: "How did you hear about us?",
		writeIn: "Somewhere else",
		choices: [
			{ value: "search", label: "Search engine" },
			{ value: "friend", label: "A friend" },
			{ value: "social", label: "Social media" },
		],
	},
];

const NO_ANSWERS: QuestionnaireAnswers = {};

export function Questionnaire3Example(): React.JSX.Element {
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
