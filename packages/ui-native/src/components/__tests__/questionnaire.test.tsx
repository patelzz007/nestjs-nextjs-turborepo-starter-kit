import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { isAnswered, Questionnaire, type QuestionnaireAnswers, type QuestionnaireProblem, type QuestionnaireQuestion, questionsInPlay } from "../questionnaire";

const QUESTIONS: readonly QuestionnaireQuestion[] = [
	{
		key: "size",
		title: "How big is your team?",
		choices: [
			{ value: "solo", label: "Just me" },
			{ value: "team", label: "A team", hint: "2 or more" },
		],
	},
	{
		key: "invite",
		title: "Who should join?",
		type: "multiple",
		choices: [
			{ value: "ava", label: "Ava" },
			{ value: "ben", label: "Ben" },
		],
		enabled: (answers: QuestionnaireAnswers): boolean => answers.size?.values.includes("team") === true,
	},
	{ key: "goal", title: "What is your goal?", optional: true, writeIn: "Something else", choices: [{ value: "ship", label: "Ship faster" }] },
];

function Harness({
	onSubmit,
	initial,
	validate,
}: {
	readonly onSubmit: jest.Mock;
	readonly initial: QuestionnaireAnswers;
	readonly validate?: React.ComponentProps<typeof Questionnaire>["validate"];
}): React.JSX.Element {
	const [answers, setAnswers] = React.useState<QuestionnaireAnswers>(initial);
	return (
		<Questionnaire questions={QUESTIONS} answers={answers} onAnswersChange={setAnswers} onSubmit={onSubmit} validate={validate} variant="card" status={<Text>Status</Text>} />
	);
}

/** A rule across answers: a goal of "nothing" sends people back to the team size. */
function soloNeedsGoal(answers: QuestionnaireAnswers): QuestionnaireProblem | null {
	return answers.goal?.text === "nothing" ? { question: "size", message: "A solo plan needs a goal." } : null;
}

describe("questionnaire helpers", () => {
	it("keeps only the questions that apply, and knows when one is answered", () => {
		expect(questionsInPlay(QUESTIONS, {}).map((question) => question.key)).toStrictEqual(["size", "goal"]);
		expect(questionsInPlay(QUESTIONS, { size: { values: ["team"], text: "", skipped: false } })).toHaveLength(3);
		const goal = QUESTIONS.at(2);
		if (goal === undefined) {
			throw new Error("Fixture missing");
		}
		expect(isAnswered(goal, { values: [], text: "", skipped: true })).toBe(true);
		expect(isAnswered(goal, undefined)).toBe(false);
	});
});

describe("Questionnaire", () => {
	it("walks through applying questions, takes several choices, skips an optional one and submits", async () => {
		const onSubmit = jest.fn();
		await render(<Harness onSubmit={onSubmit} initial={{}} />);
		expect(screen.getByText("1 of 2")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("radio", { name: "A team" }));
		expect(screen.getByText("1 of 3")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Next" }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Ava" }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Ben" }));
		expect(screen.getByText("2 selected")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Next" }));
		await fireEvent.press(screen.getByRole("button", { name: "Skip" }));
		await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
		expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ goal: { values: [], text: "", skipped: true } }));
	});

	it("takes a written answer, and sends people back when a rule fails", async () => {
		const onSubmit = jest.fn();
		await render(<Harness onSubmit={onSubmit} initial={{ size: { values: ["solo"], text: "", skipped: false } }} validate={soloNeedsGoal} />);
		await fireEvent.press(screen.getByRole("button", { name: "Next" }));
		await fireEvent.changeText(screen.getByLabelText("Something else"), "nothing");
		await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toHaveTextContent("A solo plan needs a goal.");
		expect(screen.getByRole("header", { name: "How big is your team?" })).toBeOnTheScreen();
	});
});
