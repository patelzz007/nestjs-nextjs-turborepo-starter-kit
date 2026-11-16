import * as React from "react";
import { GuidelineQuestionnaire, type GuidelineQuestion } from "@/components/component-showcase/examples/questionnaire/questionnaire-guideline-sample";

const QUESTIONS: readonly GuidelineQuestion[] = [
	{
		name: "source",
		title: "How did you hear about us?",
		description: "Optional. It helps us know what works.",
		required: false,
		choices: [
			{ value: "friend", label: "A friend" },
			{ value: "search", label: "A search" },
			{ value: "event", label: "An event" },
		],
	},
];

export function QuestionnaireDo2Example(): React.JSX.Element {
	return <GuidelineQuestionnaire questions={QUESTIONS} />;
}
