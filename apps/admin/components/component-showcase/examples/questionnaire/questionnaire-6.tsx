"use client";

import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	Questionnaire,
	QuestionnaireActions,
	QuestionnaireChoice,
	QuestionnaireChoices,
	QuestionnaireDescription,
	QuestionnaireError,
	QuestionnaireItem,
	QuestionnaireNext,
	QuestionnairePrevious,
	QuestionnaireProgress,
	QuestionnaireSubmit,
	QuestionnaireTitle,
	type QuestionnaireItemDefinition,
} from "@workspace/ui/components/questionnaire";

interface Option {
	readonly value: string;
	readonly label: string;
}

/** Shown in the summary for a question FormData carries no answer for. */
const NOT_ANSWERED = "Not answered";
/** The region and plan that may not be combined (see PLAN_CONFLICT). */
const SELF_MANAGED_REGION = "self-managed";
const STARTER_PLAN = "starter";
/** Item names: the controlled `item` state moves between these. */
const REGION_ITEM = "region";
const PLAN_ITEM = "plan";

const REGIONS: readonly Option[] = [
	{ value: "us", label: "United States" },
	{ value: "eu", label: "European Union" },
	{ value: SELF_MANAGED_REGION, label: "A region you manage" },
];

const PLANS: readonly Option[] = [
	{ value: STARTER_PLAN, label: "Starter" },
	{ value: "growth", label: "Growth" },
	{ value: "enterprise", label: "Enterprise" },
];

const SIGNERS: readonly Option[] = [
	{ value: "me", label: "I sign it myself" },
	{ value: "legal", label: "Our legal team" },
	{ value: "admin", label: "A named administrator" },
];

const ITEMS: readonly QuestionnaireItemDefinition[] = [
	{ name: REGION_ITEM, required: true },
	{ name: PLAN_ITEM, required: true },
	{ name: "signer", required: true },
];

// The one cross-question rule in this flow, written out once. No schema
// library is involved and none is missing: a single rule over two FormData
// reads costs less than a resolver, and the per-question required checks a
// schema would carry are already the primitive's job.
const PLAN_CONFLICT = "A region you manage is available on Enterprise. Pick another plan, or change the region.";

interface Summary {
	readonly region: string;
	readonly plan: string;
	readonly signer: string;
}

function labelOf(options: readonly Option[], value: FormDataEntryValue | null): string {
	return options.find((option: Option): boolean => option.value === value)?.label ?? NOT_ANSWERED;
}

export function Questionnaire6Example(): React.JSX.Element {
	// CardHeader sits between each fieldset and its legend, which stops the
	// legend naming the group. Pairing these ids with aria-labelledby on each
	// item puts that name back.
	const titleId = React.useId();

	// Controlled navigation is what makes the walk-back possible at all: item
	// and onItemChange hand the flow's position to this component, so writing to
	// it moves the visitor, and the root focuses whichever question it lands on.
	const [item, setItem] = React.useState(REGION_ITEM);
	const [planError, setPlanError] = React.useState<string | null>(null);
	const [summary, setSummary] = React.useState<Summary | null>(null);

	// Each question is already gated by the built-in required check, so nothing
	// here re-implements that. This rule spans two answers and cannot be judged
	// until both exist, which is why it runs on submit and moves item by hand.
	//
	// Rejected: noValidate={false} switches on native constraint validation, but
	// the browser judges one control at a time and answers with its own bubble,
	// so it can never express a rule that reads across two questions.
	//
	// The root re-checks every enabled item before this handler is reached, so
	// all three answers are known to exist by the time it runs and the only
	// thing left to judge is the combination.
	const handleSubmit = React.useCallback((event: React.SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		const region = formData.get(REGION_ITEM);
		const plan = formData.get(PLAN_ITEM);

		if (region === SELF_MANAGED_REGION && plan === STARTER_PLAN) {
			setPlanError(PLAN_CONFLICT);
			setItem(PLAN_ITEM);
			return;
		}

		setSummary({
			region: labelOf(REGIONS, region),
			plan: labelOf(PLANS, plan),
			signer: labelOf(SIGNERS, formData.get("signer")),
		});
	}, []);

	const startOver = React.useCallback((): void => {
		setSummary(null);
		setPlanError(null);
		setItem(REGION_ITEM);
	}, []);

	// Both questions clear the message as they change, because either answer
	// can resolve the conflict and a stale sentence under a corrected question
	// is worse than none.
	const clearPlanError = React.useCallback((): void => {
		setPlanError(null);
	}, []);

	if (summary !== null) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader>
					<CardTitle>Agreement on its way</CardTitle>
					<CardDescription>The data agreement has been drafted against these three answers and sent for signature.</CardDescription>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-3">
						<div className="grid min-w-0 gap-0.5">
							<dt className="text-sm text-muted-foreground">Data residency</dt>
							<dd className="text-sm font-medium">{summary.region}</dd>
						</div>
						<div className="grid min-w-0 gap-0.5">
							<dt className="text-sm text-muted-foreground">Plan</dt>
							<dd className="text-sm font-medium">{summary.plan}</dd>
						</div>
						<div className="grid min-w-0 gap-0.5">
							<dt className="text-sm text-muted-foreground">Signed by</dt>
							<dd className="text-sm font-medium">{summary.signer}</dd>
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
		<Questionnaire className="mx-auto w-full max-w-md" item={item} items={ITEMS} onItemChange={setItem} onSubmit={handleSubmit}>
			<Card>
				<QuestionnaireItem aria-labelledby={`${titleId}-region`} name={REGION_ITEM} required>
					<CardHeader>
						<QuestionnaireTitle id={`${titleId}-region`} render={<CardTitle />}>
							Where should your data live?
						</QuestionnaireTitle>
						<QuestionnaireDescription render={<CardDescription />}>Residency is fixed once the workspace is created.</QuestionnaireDescription>
						<CardAction>
							<QuestionnaireProgress />
						</CardAction>
					</CardHeader>
					<CardContent>
						<QuestionnaireChoices>
							{REGIONS.map((region: Option): React.JSX.Element => (
								<QuestionnaireChoice key={region.value} value={region.value} onChange={clearPlanError}>
									{region.label}
								</QuestionnaireChoice>
							))}
						</QuestionnaireChoices>
						<QuestionnaireError />
					</CardContent>
				</QuestionnaireItem>

				<QuestionnaireItem
					aria-labelledby={`${titleId}-plan`}
					name={PLAN_ITEM}
					required
					// invalid and the error children are separate on purpose: the flag
					// drives the styling and the alert role, the children supply the
					// sentence. Null rather than an empty string leaves the primitive's
					// own required copy in place for the ordinary unanswered case.
					//
					// The flag also blocks Next while it is set, so the rule holds on the
					// way forward and not only on the way out. The visitor cannot
					// walk past the question that broke it and meet the same message
					// again at the end.
					invalid={planError !== null}>
					<CardHeader>
						<QuestionnaireTitle id={`${titleId}-plan`} render={<CardTitle />}>
							Which plan are you on?
						</QuestionnaireTitle>
						<QuestionnaireDescription render={<CardDescription />}>Not every region is offered on every plan.</QuestionnaireDescription>
						<CardAction>
							<QuestionnaireProgress />
						</CardAction>
					</CardHeader>
					<CardContent>
						<QuestionnaireChoices>
							{PLANS.map((plan: Option): React.JSX.Element => (
								<QuestionnaireChoice key={plan.value} value={plan.value} onChange={clearPlanError}>
									{plan.label}
								</QuestionnaireChoice>
							))}
						</QuestionnaireChoices>
						<QuestionnaireError>{planError}</QuestionnaireError>
					</CardContent>
				</QuestionnaireItem>

				<QuestionnaireItem aria-labelledby={`${titleId}-signer`} name="signer" required>
					<CardHeader>
						<QuestionnaireTitle id={`${titleId}-signer`} render={<CardTitle />}>
							Who signs the data agreement?
						</QuestionnaireTitle>
						<QuestionnaireDescription render={<CardDescription />}>We send it for signature as soon as this flow is finished.</QuestionnaireDescription>
						<CardAction>
							<QuestionnaireProgress />
						</CardAction>
					</CardHeader>
					<CardContent>
						<QuestionnaireChoices>
							{SIGNERS.map((signer: Option): React.JSX.Element => (
								<QuestionnaireChoice key={signer.value} value={signer.value}>
									{signer.label}
								</QuestionnaireChoice>
							))}
						</QuestionnaireChoices>
						<QuestionnaireError />
					</CardContent>
				</QuestionnaireItem>

				<CardFooter>
					<QuestionnaireActions className="w-full">
						<QuestionnairePrevious />
						<QuestionnaireNext>Next</QuestionnaireNext>
						<QuestionnaireSubmit>Request the agreement</QuestionnaireSubmit>
					</QuestionnaireActions>
				</CardFooter>
			</Card>
		</Questionnaire>
	);
}
