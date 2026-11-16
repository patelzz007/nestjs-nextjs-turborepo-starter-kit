import { Badge } from "@workspace/ui-native/components/badge";
import { Questionnaire, type QuestionnaireAnswers, type QuestionnaireQuestion } from "@workspace/ui-native/components/questionnaire";
import * as React from "react";
import { Text } from "react-native";

const QUESTIONS: readonly QuestionnaireQuestion[] = [
	{
		key: "role",
		title: "What is your role?",
		choices: [
			{ value: "design", label: "Design" },
			{ value: "eng", label: "Engineering" },
			{ value: "pm", label: "Product" },
		],
	},
	{
		key: "feedback",
		title: "Anything we could do better?",
		optional: true,
		writeIn: "Tell us",
		choices: [
			{ value: "speed", label: "Speed" },
			{ value: "docs", label: "Docs" },
		],
	},
	{
		key: "contact",
		title: "May we contact you?",
		choices: [
			{ value: "yes", label: "Yes" },
			{ value: "no", label: "No" },
		],
	},
];

const NO_ANSWERS: QuestionnaireAnswers = {};

export function QuestionnaireDo2Example(): React.JSX.Element {
	const [answers, setAnswers] = React.useState<QuestionnaireAnswers>(NO_ANSWERS);
	const [done, setDone] = React.useState(false);
	const submit = React.useCallback((): void => {
		setDone(true);
	}, []);
	const feedback = answers.feedback;
	let label = "Not answered";
	if (feedback?.skipped === true) {
		label = "Skipped";
	} else if (feedback !== undefined && (feedback.values.length > 0 || feedback.text.length > 0)) {
		label = "Answered";
	}
	const status = <Badge label={`Optional: ${label}`} size="sm" />;
	if (done) {
		return <Text className="text-body font-sans text-foreground">All set. Your workspace is ready.</Text>;
	}
	return <Questionnaire questions={QUESTIONS} answers={answers} onAnswersChange={setAnswers} onSubmit={submit} variant="card" status={status} />;
}
