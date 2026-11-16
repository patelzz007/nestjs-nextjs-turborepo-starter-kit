import * as React from "react";
import { GuidelineQuestionnaire, type GuidelineQuestion } from "@/components/component-showcase/examples/questionnaire/questionnaire-guideline-sample";

const QUESTIONS: readonly GuidelineQuestion[] = [
	{
		name: "source",
		title: "How did you hear about us?",
		required: true,
		choices: [
			{ value: "friend", label: "A friend" },
			{ value: "search", label: "A search" },
			{ value: "event", label: "An event" },
		],
	},
];

export function QuestionnaireDont2Example(): React.JSX.Element {
	return <GuidelineQuestionnaire questions={QUESTIONS} />;
}
