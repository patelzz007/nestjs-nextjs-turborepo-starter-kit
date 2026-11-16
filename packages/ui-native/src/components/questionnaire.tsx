// A one-question-at-a-time flow (the web kit's `Questionnaire`): a guided
// setup, a survey, an intake form. Each question is single choice (radio
// rows) or several choices (checkbox rows), each choice with a letter and an
// optional hint, and may take a written answer that stands in for a choice.
// A question can be optional (with Skip), and can apply only when earlier
// answers say so (`enabled`). Progress shows as "2 of 4" or as segments; Back
// and Next move between questions, and the last Next submits.
//
// A rule across answers (`validate`) can stop the submit and send people back
// to the question to change, with the caller's message. Controlled: `answers`
// in, `onAnswersChange` out; the open question is the flow's own display
// state unless the caller owns it (`step` + `onStepChange`). The ref reaches
// the root view.

import { cva } from "class-variance-authority";
import CheckIcon from "lucide-react-native/icons/check";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Button } from "./button";
import { Icon } from "./icon";
import { TextField } from "./text-field";

export interface QuestionnaireChoice {
	readonly value: string;
	readonly label: string;
	/** A line under the label. */
	readonly hint?: string | undefined;
}

export interface QuestionnaireQuestion {
	readonly key: string;
	readonly title: string;
	readonly description?: string | undefined;
	/** One choice (default) or several. */
	readonly type?: "single" | "multiple" | undefined;
	readonly choices: readonly QuestionnaireChoice[];
	/** People may skip it. */
	readonly optional?: boolean | undefined;
	/** A written answer, standing in for a choice: its field's label. */
	readonly writeIn?: string | undefined;
	/** The question applies only when this says so, from the answers so far. */
	readonly enabled?: ((answers: QuestionnaireAnswers) => boolean) | undefined;
	/** A short name for the segmented progress ("Team"). */
	readonly step?: string | undefined;
}

export interface QuestionnaireAnswer {
	readonly values: readonly string[];
	readonly text: string;
	readonly skipped: boolean;
}

export type QuestionnaireAnswers = Readonly<Record<string, QuestionnaireAnswer | undefined>>;

/** Why the answers cannot be submitted, and the question (by key) to send people back to. */
export interface QuestionnaireProblem {
	readonly question: string;
	readonly message: string;
}

export interface QuestionnaireLabels {
	readonly back: string;
	readonly next: string;
	readonly submit: string;
	readonly skip: string;
	readonly progress: (current: number, total: number) => string;
	readonly selected: (count: number) => string;
}

export const DEFAULT_QUESTIONNAIRE_LABELS: QuestionnaireLabels = {
	back: "Back",
	next: "Next",
	submit: "Submit",
	skip: "Skip",
	progress: (current: number, total: number): string => `${String(current)} of ${String(total)}`,
	selected: (count: number): string => `${String(count)} selected`,
};

export const questionnaireVariants = cva("gap-4", {
	variants: {
		variant: { plain: "", card: "rounded-card border border-border bg-card p-4" },
	},
	defaultVariants: { variant: "plain" },
});

export const questionnaireChoiceVariants = cva("min-h-12 flex-row items-center gap-3 rounded-lg border px-3 py-2.5", {
	variants: {
		picked: { true: "border-primary bg-primary/10", false: "border-border bg-card active:bg-muted" },
	},
	defaultVariants: { picked: false },
});

const questionnaireKeyVariants = cva("size-6 items-center justify-center rounded-md border", {
	variants: {
		picked: { true: "border-primary bg-primary", false: "border-border bg-muted" },
	},
	defaultVariants: { picked: false },
});

const questionnaireSegmentVariants = cva("h-1.5 flex-1 rounded-full", {
	variants: {
		reached: { true: "bg-primary", false: "bg-border" },
	},
	defaultVariants: { reached: false },
});

const EMPTY_ANSWER: QuestionnaireAnswer = { values: [], text: "", skipped: false };
const LETTER_A = 65;

/** The questions that apply to these answers, in order. */
export function questionsInPlay(questions: readonly QuestionnaireQuestion[], answers: QuestionnaireAnswers): readonly QuestionnaireQuestion[] {
	return questions.filter((question: QuestionnaireQuestion): boolean => question.enabled?.(answers) ?? true);
}

/** Whether a question has what it needs to move on: a choice, a written answer, or (optional ones) a skip. */
export function isAnswered(question: QuestionnaireQuestion, answer: QuestionnaireAnswer | undefined): boolean {
	if (answer === undefined) {
		return false;
	}
	return answer.values.length > 0 || answer.text.trim().length > 0 || (question.optional === true && answer.skipped);
}

export interface QuestionnaireProps {
	readonly questions: readonly QuestionnaireQuestion[];
	readonly answers: QuestionnaireAnswers;
	readonly onAnswersChange: (answers: QuestionnaireAnswers) => void;
	/** Every applying question is answered (and `validate` passed). */
	readonly onSubmit: (answers: QuestionnaireAnswers) => void;
	/** A rule across answers: a problem stops the submit and opens its question. */
	readonly validate?: ((answers: QuestionnaireAnswers) => QuestionnaireProblem | null) | undefined;
	/** The open question (0-based, among those that apply): the caller's, with `onStepChange`. */
	readonly step?: number | undefined;
	readonly onStepChange?: ((step: number) => void) | undefined;
	/** "2 of 4" (default) or segments with the step's name. */
	readonly progress?: "counter" | "segments" | undefined;
	/** Beside the progress: a status badge. */
	readonly status?: React.ReactNode | undefined;
	readonly variant?: "plain" | "card" | undefined;
	readonly labels?: Partial<QuestionnaireLabels> | undefined;
	/** Extra classes for the root view, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

interface ChoiceRowProps {
	readonly choice: QuestionnaireChoice;
	readonly index: number;
	readonly picked: boolean;
	readonly multiple: boolean;
	readonly onToggle: (value: string) => void;
}

const ChoiceRow = React.memo(function ChoiceRow({ choice, index, picked, multiple, onToggle }: ChoiceRowProps): React.JSX.Element {
	const toggle = React.useCallback((): void => {
		onToggle(choice.value);
	}, [choice.value, onToggle]);
	const accessibilityState = React.useMemo(() => ({ checked: picked }), [picked]);
	return (
		<Pressable
			accessibilityRole={multiple ? "checkbox" : "radio"}
			accessibilityLabel={choice.label}
			accessibilityHint={choice.hint}
			accessibilityState={accessibilityState}
			onPress={toggle}
			className={questionnaireChoiceVariants({ picked })}>
			<View className={questionnaireKeyVariants({ picked })}>
				{picked && multiple ? (
					<Icon icon={CheckIcon} size="xs" colorClassName="accent-primary-foreground" />
				) : (
					<Text className={cn("text-caption font-sans-semibold", picked ? "text-primary-foreground" : "text-muted-foreground")}>{String.fromCharCode(LETTER_A + index)}</Text>
				)}
			</View>
			<View className="flex-1 gap-0.5">
				<Text className="text-body font-sans-medium text-foreground">{choice.label}</Text>
				{choice.hint === undefined ? null : <Text className="text-caption font-sans text-muted-foreground">{choice.hint}</Text>}
			</View>
		</Pressable>
	);
});

export const Questionnaire = React.memo(
	React.forwardRef<ViewInstance, QuestionnaireProps>(function Questionnaire(
		{
			questions,
			answers,
			onAnswersChange,
			onSubmit,
			validate,
			step: shownStep,
			onStepChange,
			progress = "counter",
			status,
			variant = "plain",
			labels: labelOverrides,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const labels = React.useMemo((): QuestionnaireLabels => ({ ...DEFAULT_QUESTIONNAIRE_LABELS, ...labelOverrides }), [labelOverrides]);
		const [ownStep, setOwnStep] = React.useState(0);
		const [problem, setProblem] = React.useState<string | null>(null);
		const inPlay = questionsInPlay(questions, answers);
		const step = Math.min(shownStep ?? ownStep, Math.max(inPlay.length - 1, 0));
		const question = inPlay.at(step);
		const answer = question === undefined ? EMPTY_ANSWER : (answers[question.key] ?? EMPTY_ANSWER);
		const multiple = question?.type === "multiple";
		const isLast = step === inPlay.length - 1;

		const goTo = React.useCallback(
			(next: number): void => {
				setOwnStep(next);
				onStepChange?.(next);
			},
			[onStepChange],
		);
		const setAnswer = React.useCallback(
			(next: QuestionnaireAnswer): void => {
				if (question === undefined) {
					return;
				}
				setProblem(null);
				onAnswersChange({ ...answers, [question.key]: next });
			},
			[answers, onAnswersChange, question],
		);
		const toggle = React.useCallback(
			(value: string): void => {
				const values = multiple ? (answer.values.includes(value) ? answer.values.filter((picked: string): boolean => picked !== value) : [...answer.values, value]) : [value];
				setAnswer({ values, text: multiple ? answer.text : "", skipped: false });
			},
			[answer.text, answer.values, multiple, setAnswer],
		);
		const write = React.useCallback(
			(text: string): void => {
				setAnswer({ values: multiple ? answer.values : [], text, skipped: false });
			},
			[answer.values, multiple, setAnswer],
		);
		const back = React.useCallback((): void => {
			setProblem(null);
			goTo(Math.max(step - 1, 0));
		}, [goTo, step]);
		const skip = React.useCallback((): void => {
			setAnswer({ values: [], text: "", skipped: true });
			if (!isLast) {
				goTo(step + 1);
			}
		}, [goTo, isLast, setAnswer, step]);
		const next = React.useCallback((): void => {
			if (!isLast) {
				goTo(step + 1);
				return;
			}
			const found = validate?.(answers) ?? null;
			if (found !== null) {
				setProblem(found.message);
				const at = inPlay.findIndex((candidate: QuestionnaireQuestion): boolean => candidate.key === found.question);
				goTo(Math.max(at, 0));
				return;
			}
			onSubmit(answers);
		}, [answers, goTo, inPlay, isLast, onSubmit, step, validate]);

		if (question === undefined) {
			return <View ref={ref} testID={testID} />;
		}
		const ready = isAnswered(question, answer);
		return (
			<View ref={ref} testID={testID} className={cn(questionnaireVariants({ variant }), className)}>
				<View className="gap-2">
					{progress === "segments" ? (
						<>
							<View className="flex-row gap-1" importantForAccessibility="no-hide-descendants">
								{inPlay.map((item: QuestionnaireQuestion, index: number): React.JSX.Element => (
									<View key={item.key} className={questionnaireSegmentVariants({ reached: index <= step })} />
								))}
							</View>
							<Text accessibilityLiveRegion="polite" className="text-caption font-sans text-muted-foreground">
								{`${labels.progress(step + 1, inPlay.length)} · ${question.step ?? question.title}`}
							</Text>
						</>
					) : (
						<View className="flex-row items-center gap-2">
							<Text accessibilityLiveRegion="polite" className="text-caption font-sans-medium text-muted-foreground tabular-nums">
								{labels.progress(step + 1, inPlay.length)}
							</Text>
							{multiple && answer.values.length > 0 ? (
								<View className="rounded-full bg-muted px-2 py-px">
									<Text className="text-overline font-sans-semibold text-foreground">{labels.selected(answer.values.length)}</Text>
								</View>
							) : null}
							{status ?? null}
						</View>
					)}
					<Text accessibilityRole="header" className="text-h3 font-heading text-foreground">
						{question.title}
					</Text>
					{question.description === undefined ? null : <Text className="text-body font-sans text-muted-foreground">{question.description}</Text>}
				</View>
				<View accessibilityRole={multiple ? undefined : "radiogroup"} accessibilityLabel={question.title} className="gap-2">
					{question.choices.map((choice: QuestionnaireChoice, index: number): React.JSX.Element => (
						<ChoiceRow key={choice.value} choice={choice} index={index} picked={answer.values.includes(choice.value)} multiple={multiple} onToggle={toggle} />
					))}
				</View>
				{question.writeIn === undefined ? null : <TextField label={question.writeIn} value={answer.text} onChange={write} />}
				{problem === null ? null : (
					<Text accessibilityRole="alert" className="text-body font-sans text-destructive-foreground">
						{problem}
					</Text>
				)}
				<View className="flex-row items-center gap-2">
					<Button label={labels.back} variant="ghost" onPress={back} disabled={step === 0} />
					<View className="flex-1" />
					{question.optional === true ? <Button label={labels.skip} variant="outline" onPress={skip} /> : null}
					<Button label={isLast ? labels.submit : labels.next} onPress={next} disabled={!ready} />
				</View>
			</View>
		);
	}),
);
