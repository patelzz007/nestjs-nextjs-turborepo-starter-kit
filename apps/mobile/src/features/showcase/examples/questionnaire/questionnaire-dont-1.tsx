import { Questionnaire, type QuestionnaireAnswers, type QuestionnaireQuestion } from "@workspace/ui-native/components/questionnaire";
import * as React from "react";
import { Text } from "react-native";

const QUESTIONS: readonly QuestionnaireQuestion[] = [
	{
		key: "everything",
		title: "Tell us your role, team size, tools, goals and budget",
		type: "multiple",
		choices: [
			{ value: "a", label: "Designer, 2–10 people, Figma, speed, < $100" },
			{ value: "b", label: "Engineer, 11+, GitHub, quality, $100–$500" },
			{ value: "c", label: "Manager, just me, Jira, reporting, > $500" },
		],
	},
];

const NO_ANSWERS: QuestionnaireAnswers = {};

export function QuestionnaireDont1Example(): React.JSX.Element {
	const [answers, setAnswers] = React.useState<QuestionnaireAnswers>(NO_ANSWERS);
	const [done, setDone] = React.useState(false);
	const submit = React.useCallback((): void => {
		setDone(true);
	}, []);
	if (done) {
		return <Text className="text-body font-sans text-foreground">All set. Your workspace is ready.</Text>;
	}
	return <Questionnaire questions={QUESTIONS} answers={answers} onAnswersChange={setAnswers} onSubmit={submit} />;
}
