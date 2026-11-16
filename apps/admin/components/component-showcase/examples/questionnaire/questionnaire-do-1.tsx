import * as React from "react";
import { GuidelineQuestionnaire, type GuidelineQuestion } from "@/components/component-showcase/examples/questionnaire/questionnaire-guideline-sample";

const QUESTIONS: readonly GuidelineQuestion[] = [
	{
		name: "team-size",
		title: "How big is your team?",
		required: true,
		choices: [
			{ value: "solo", label: "Just me" },
			{ value: "small", label: "2 to 10" },
			{ value: "large", label: "More than 10" },
		],
	},
	{
		name: "goal",
		title: "What do you want to do first?",
		required: true,
		choices: [
			{ value: "invoices", label: "Send invoices" },
			{ value: "projects", label: "Track projects" },
		],
	},
];

export function QuestionnaireDo1Example(): React.JSX.Element {
	return <GuidelineQuestionnaire questions={QUESTIONS} />;
}
