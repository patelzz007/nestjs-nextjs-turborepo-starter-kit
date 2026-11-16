"use client";

import { isStringPrimitive } from "@workspace/shared";
import * as React from "react";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	Questionnaire,
	QuestionnaireActions,
	QuestionnaireChoice,
	QuestionnaireChoices,
	QuestionnaireDescription,
	QuestionnaireError,
	QuestionnaireInput,
	QuestionnaireItem,
	QuestionnaireNext,
	QuestionnairePrevious,
	QuestionnaireProgress,
	QuestionnaireSkip,
	QuestionnaireSubmit,
	QuestionnaireTitle,
	type QuestionnaireItemDefinition,
	type QuestionnaireItemStatus,
} from "@workspace/ui/components/questionnaire";

interface Option {
	readonly value: string;
	readonly label: string;
}

/** Shown in the summary for a question FormData carries no answer for. */
const NOT_ANSWERED = "Not answered";
/** The optional question's status before the visitor touches it. */
const INITIAL_WATCH_STATUS: QuestionnaireItemStatus = "unanswered";

const CURRENT: readonly Option[] = [
	{ value: "sheets", label: "Spreadsheets on a shared drive" },
	{ value: "legacy", label: "An in-house tool" },
	{ value: "vendor", label: "Another vendor" },
];

const WATCH: readonly Option[] = [
	{ value: "fields", label: "Custom fields we cannot lose" },
	{ value: "exports", label: "Historical exports" },
	{ value: "sso", label: "Single sign-on" },
];

const WINDOWS: readonly Option[] = [
	{ value: "weekend", label: "A weekend" },
	{ value: "evening", label: "A weekday evening" },
	{ value: "anytime", label: "Any time, we can take downtime" },
];

// Omitting required from this one entry is the whole switch. Skip renders only
// while the active item is optional, so it appears on the middle question and
// on neither of its neighbours.
//
// Optional does not mean passable. An item counts as satisfied when it is
// answered, skipped or disabled, so the visitor still has to declare one way
// or the other before Next will move off the middle question.
const ITEMS: readonly QuestionnaireItemDefinition[] = [{ name: "from", required: true }, { name: "watch" }, { name: "window", required: true }];

interface WatchBadge {
	readonly label: string;
	readonly variant: BadgeVariant;
}

const WATCH_BADGE: Readonly<Record<QuestionnaireItemStatus, WatchBadge>> = {
	answered: { label: "Optional - answered", variant: "primary-light" },
	skipped: { label: "Optional - skipped", variant: "outline" },
	unanswered: { label: "Optional - not answered", variant: "secondary" },
};

interface Summary {
	readonly from: string;
	readonly watch: string;
	readonly window: string;
}

// The optional question takes a written note as well as three choices, and
// either of them marks it answered. An entry matching no choice is that note,
// so it comes back as typed rather than mapped.
function answerLabel(options: readonly Option[], value: FormDataEntryValue | null): string {
	if (!isStringPrimitive(value) || value.trim() === "") {
		return NOT_ANSWERED;
	}

	return options.find((option: Option): boolean => option.value === value)?.label ?? value;
}

export function Questionnaire5Example(): React.JSX.Element {
	// CardHeader sits between each fieldset and its legend, which stops the
	// legend naming the group. Pairing these ids with aria-labelledby on each
	// item puts that name back.
	const titleId = React.useId();

	// Skip clears whatever was ticked before it marks the item skipped, so a
	// half-answer can never ride along with a declined question. Answering
	// afterwards flips the status back, which is why the two cannot both hold.
	const [watchStatus, setWatchStatus] = React.useState<QuestionnaireItemStatus>(INITIAL_WATCH_STATUS);
	const [summary, setSummary] = React.useState<Summary | null>(null);

	// Skipping is not the same as leaving a question blank, and FormData cannot
	// tell them apart: both arrive as nothing. onStatusChange is the only place
	// that distinction survives, which is what the middle row below reports.
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();

			const formData = new FormData(event.currentTarget);

			setSummary({
				from: answerLabel(CURRENT, formData.get("from")),
				watch: watchStatus === "skipped" ? "Skipped" : answerLabel(WATCH, formData.get("watch")),
				window: answerLabel(WINDOWS, formData.get("window")),
			});
		},
		[watchStatus],
	);

	// The flow unmounts while the summary is on screen, so the mirrored status
	// has to be cleared alongside it. Leaving it would reopen an untouched
	// question under a badge still reporting it as skipped.
	const startOver = React.useCallback((): void => {
		setSummary(null);
		setWatchStatus(INITIAL_WATCH_STATUS);
	}, []);

	const watchBadge = WATCH_BADGE[watchStatus];

	if (summary !== null) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader>
					<CardTitle>Migration booked</CardTitle>
					<CardDescription>An engineer will confirm the window by email within one working day.</CardDescription>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-3">
						<div className="grid min-w-0 gap-0.5">
							<dt className="text-sm text-muted-foreground">Moving off</dt>
							<dd className="text-sm font-medium">{summary.from}</dd>
						</div>
						<div className="grid min-w-0 gap-0.5">
							<dt className="text-sm text-muted-foreground">Watch out for</dt>
							<dd className="text-sm font-medium">{summary.watch}</dd>
						</div>
						<div className="grid min-w-0 gap-0.5">
							<dt className="text-sm text-muted-foreground">Window</dt>
							<dd className="text-sm font-medium">{summary.window}</dd>
						</div>
					</dl>
				</CardContent>
				<CardFooter>
					<Button size="sm" variant="outline" onClick={startOver}>
						Start over
					</Button>
				</CardFooter>
			</Card>
		);
	}

	return (
		// The header row below lives outside the card on purpose. Only the active
		// fieldset has a layout box, so anything inside the card moves with the
		// question, while the progress and the badge should stay put across all
		// three.
		<Questionnaire className="mx-auto w-full max-w-md" defaultItem="from" items={ITEMS} onSubmit={handleSubmit}>
			<div className="flex items-center justify-between gap-2">
				<QuestionnaireProgress />
				<Badge variant={watchBadge.variant}>{watchBadge.label}</Badge>
			</div>

			<Card>
				<QuestionnaireItem aria-labelledby={`${titleId}-from`} name="from" required>
					<CardHeader>
						<QuestionnaireTitle id={`${titleId}-from`} render={<CardTitle />}>
							What are you moving off?
						</QuestionnaireTitle>
						<QuestionnaireDescription render={<CardDescription />}>We have an importer for each of these.</QuestionnaireDescription>
					</CardHeader>
					<CardContent>
						<QuestionnaireChoices>
							{CURRENT.map((option: Option): React.JSX.Element => (
								<QuestionnaireChoice key={option.value} value={option.value}>
									{option.label}
								</QuestionnaireChoice>
							))}
						</QuestionnaireChoices>
						<QuestionnaireError />
					</CardContent>
				</QuestionnaireItem>

				<QuestionnaireItem aria-labelledby={`${titleId}-watch`} name="watch" onStatusChange={setWatchStatus}>
					<CardHeader>
						<QuestionnaireTitle id={`${titleId}-watch`} render={<CardTitle />}>
							Anything we should watch out for?
						</QuestionnaireTitle>
						<QuestionnaireDescription render={<CardDescription />}>Skip this if nothing comes to mind. It changes the plan, not the price.</QuestionnaireDescription>
					</CardHeader>
					<CardContent>
						<QuestionnaireChoices>
							{WATCH.map((option: Option): React.JSX.Element => (
								<QuestionnaireChoice key={option.value} value={option.value}>
									{option.label}
								</QuestionnaireChoice>
							))}
							<QuestionnaireInput aria-label="Something else to watch out for" placeholder="Something else" />
						</QuestionnaireChoices>
						<QuestionnaireError />
					</CardContent>
				</QuestionnaireItem>

				<QuestionnaireItem aria-labelledby={`${titleId}-window`} name="window" required>
					<CardHeader>
						<QuestionnaireTitle id={`${titleId}-window`} render={<CardTitle />}>
							When is your migration window?
						</QuestionnaireTitle>
						<QuestionnaireDescription render={<CardDescription />}>Expect roughly two hours of read-only access.</QuestionnaireDescription>
					</CardHeader>
					<CardContent>
						<QuestionnaireChoices>
							{WINDOWS.map((option: Option): React.JSX.Element => (
								<QuestionnaireChoice key={option.value} value={option.value}>
									{option.label}
								</QuestionnaireChoice>
							))}
						</QuestionnaireChoices>
						<QuestionnaireError />
					</CardContent>
				</QuestionnaireItem>

				<CardFooter>
					<QuestionnaireActions
						// Nothing extra goes in this grid. Its three columns are assigned
						// to Previous, Skip and Next or Submit, so a fourth child lands in
						// column one and jumps to a second row once Previous appears.
						//
						// The buttons hide with the hidden attribute over an inline-flex
						// base class, which only wins because preflight marks [hidden] as
						// display:none with !important. Without it, all four show at once.
						className="w-full">
						<QuestionnairePrevious />
						<QuestionnaireSkip>Skip for now</QuestionnaireSkip>
						<QuestionnaireNext>Next</QuestionnaireNext>
						<QuestionnaireSubmit>Book the migration</QuestionnaireSubmit>
					</QuestionnaireActions>
				</CardFooter>
			</Card>
		</Questionnaire>
	);
}
