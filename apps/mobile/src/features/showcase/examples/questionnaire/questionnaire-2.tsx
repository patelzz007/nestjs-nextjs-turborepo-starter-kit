import { Questionnaire, type QuestionnaireAnswers, type QuestionnaireQuestion } from "@workspace/ui-native/components/questionnaire";
import * as React from "react";
import { Text } from "react-native";

const QUESTIONS: readonly QuestionnaireQuestion[] = [
	{
		key: "tools",
		title: "Which tools does your team use?",
		description: "Pick all that apply.",
		type: "multiple",
		choices: [
			{ value: "github", label: "GitHub" },
			{ value: "slack", label: "Slack" },
			{ value: "figma", label: "Figma" },
			{ value: "jira", label: "Jira" },
			{ value: "notion", label: "Notion" },
			{ value: "linear", label: "Linear" },
		],
	},
	{
		key: "sync",
		title: "Sync daily?",
		choices: [
			{ value: "yes", label: "Yes" },
			{ value: "no", label: "No" },
		],
	},
];

const NO_ANSWERS: QuestionnaireAnswers = {};

export function Questionnaire2Example(): React.JSX.Element {
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
