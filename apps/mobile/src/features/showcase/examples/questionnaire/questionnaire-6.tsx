import { Questionnaire, type QuestionnaireAnswers, type QuestionnaireQuestion } from "@workspace/ui-native/components/questionnaire";
import * as React from "react";
import { Text } from "react-native";

const QUESTIONS: readonly QuestionnaireQuestion[] = [
	{
		key: "plan",
		title: "Which plan?",
		choices: [
			{ value: "free", label: "Free" },
			{ value: "pro", label: "Pro" },
		],
	},
	{
		key: "region",
		title: "Where should data live?",
		choices: [
			{ value: "eu", label: "Europe" },
			{ value: "us", label: "United States" },
		],
	},
	{
		key: "sso",
		title: "Turn on single sign-on?",
		choices: [
			{ value: "yes", label: "Yes" },
			{ value: "no", label: "No" },
		],
	},
];

/** Single sign-on needs the Pro plan: a failed check sends people back to the plan. */
function freePlanRule(answers: QuestionnaireAnswers): { readonly question: string; readonly message: string } | null {
	return answers.plan?.values.includes("free") === true && answers.sso?.values.includes("yes") === true
		? { question: "plan", message: "Single sign-on needs the Pro plan. Change the plan, or turn single sign-on off." }
		: null;
}

const NO_ANSWERS: QuestionnaireAnswers = {};

export function Questionnaire6Example(): React.JSX.Element {
	const [answers, setAnswers] = React.useState<QuestionnaireAnswers>(NO_ANSWERS);
	const [done, setDone] = React.useState(false);
	const submit = React.useCallback((): void => {
		setDone(true);
	}, []);
	const [step, setStep] = React.useState(0);
	if (done) {
		return <Text className="text-body font-sans text-foreground">All set. Your workspace is ready.</Text>;
	}
	return <Questionnaire questions={QUESTIONS} answers={answers} onAnswersChange={setAnswers} onSubmit={submit} validate={freePlanRule} step={step} onStepChange={setStep} />;
}
