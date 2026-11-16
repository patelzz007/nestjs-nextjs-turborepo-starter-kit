import * as React from "react";
import { GuidelineQuestionnaire, type GuidelineQuestion } from "@/components/component-showcase/examples/questionnaire/questionnaire-guideline-sample";

const QUESTIONS: readonly GuidelineQuestion[] = [
	{
		name: "team-and-goal",
		title: "How big is your team, and what do you want to do first?",
		required: true,
		choices: [
			{ value: "solo-invoices", label: "Just me, and I want to send invoices before anything else" },
			{ value: "small-projects", label: "2 to 10 people, and we mostly need to track projects" },
			{ value: "large-both", label: "More than 10, and both invoices and projects matter equally" },
		],
	},
];

export function QuestionnaireDont1Example(): React.JSX.Element {
	return <GuidelineQuestionnaire questions={QUESTIONS} />;
}
