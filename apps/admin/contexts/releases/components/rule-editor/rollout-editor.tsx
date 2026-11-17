"use client";

import { epochMs, PERCENTAGE_MAX, PERCENTAGE_MIN, type RolloutInput as Rollout, type RolloutStep } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { OptionSelectField } from "@/components/common/form-fields";

import { epochFromLocal, localFromEpoch } from "./condition-editor";

const KIND_LABELS: Readonly<Record<Rollout["kind"], string>> = { FIXED: "A fixed share", SCHEDULED: "A scheduled ramp" };
const ROLLOUT_KINDS: readonly Rollout["kind"][] = ["FIXED", "SCHEDULED"];
const MS_PER_DAY = 86_400_000;
const FIRST_STEP_SHARE = 10;
const DECIMAL_RADIX = 10;

type ScheduledRollout = Extract<Rollout, { readonly kind: "SCHEDULED" }>;
/** One step of a scheduled rollout, as the form holds it. */
type RolloutStepInput = ScheduledRollout["steps"][number];

/** A share typed into a box, kept inside 0–100 (an empty box reads 0). */
export function clampPercentage(text: string): number {
	const value = Number.parseInt(text, DECIMAL_RADIX);
	return Number.isNaN(value) ? PERCENTAGE_MIN : Math.min(PERCENTAGE_MAX, Math.max(PERCENTAGE_MIN, value));
}

/** The first ramp: 10% tomorrow, everyone the day after. */
export function firstRamp(now: number): RolloutStep[] {
	return [
		{ at: epochMs(now + MS_PER_DAY), percentage: FIRST_STEP_SHARE },
		{ at: epochMs(now + 2 * MS_PER_DAY), percentage: PERCENTAGE_MAX },
	];
}

/** A ramp with one more step: a day after its last (or after `now`), for everyone. */
export function withNextStep(steps: readonly RolloutStepInput[], now: number): RolloutStepInput[] {
	const last = steps.reduce<number>((latest, existing) => Math.max(latest, existing.at), now);
	return [...steps, { at: epochMs(last + MS_PER_DAY), percentage: PERCENTAGE_MAX }];
}

function kindLabel(kind: Rollout["kind"]): string {
	return KIND_LABELS[kind];
}

export interface RolloutEditorProps {
	readonly id: string;
	readonly rollout: Rollout;
	readonly onChange: (rollout: Rollout) => void;
}

function FixedShareEditor({
	id,
	percentage,
	onChange,
}: {
	readonly id: string;
	readonly percentage: number;
	readonly onChange: (rollout: Rollout) => void;
}): React.JSX.Element {
	const setShare = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange({ kind: "FIXED", percentage: clampPercentage(event.target.value) });
		},
		[onChange],
	);
	return (
		<div className="max-w-40 space-y-1.5">
			<Label htmlFor={`${id}-percentage`}>Share (%)</Label>
			<Input id={`${id}-percentage`} type="number" inputMode="numeric" min={PERCENTAGE_MIN} max={PERCENTAGE_MAX} value={String(percentage)} onChange={setShare} />
		</div>
	);
}

interface StepRowProps {
	readonly id: string;
	readonly index: number;
	readonly steps: readonly RolloutStepInput[];
	readonly onChange: (rollout: Rollout) => void;
}

function StepRow({ id, index, steps, onChange }: StepRowProps): React.JSX.Element | null {
	const step = steps.at(index);
	const replace = React.useCallback(
		(next: RolloutStepInput): void => {
			onChange({ kind: "SCHEDULED", steps: steps.map((existing, position) => (position === index ? next : existing)) });
		},
		[index, onChange, steps],
	);
	const setAt = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const at = epochFromLocal(event.target.value);
			if (at !== null && step !== undefined) {
				replace({ ...step, at });
			}
		},
		[replace, step],
	);
	const setShare = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			if (step !== undefined) {
				replace({ ...step, percentage: clampPercentage(event.target.value) });
			}
		},
		[replace, step],
	);
	const remove = React.useCallback((): void => {
		onChange({ kind: "SCHEDULED", steps: steps.filter((_existing, position) => position !== index) });
	}, [index, onChange, steps]);
	if (step === undefined) {
		return null;
	}
	const stepId = `${id}-step-${String(index)}`;
	return (
		<div className="grid items-end gap-2 sm:grid-cols-[1fr_8rem_auto]">
			<div className="space-y-1.5">
				<Label htmlFor={`${stepId}-at`}>{`Step ${String(index + 1)} from`}</Label>
				<Input id={`${stepId}-at`} type="datetime-local" value={localFromEpoch(step.at)} onChange={setAt} />
			</div>
			<div className="space-y-1.5">
				<Label htmlFor={`${stepId}-share`}>Share (%)</Label>
				<Input id={`${stepId}-share`} type="number" inputMode="numeric" min={PERCENTAGE_MIN} max={PERCENTAGE_MAX} value={String(step.percentage)} onChange={setShare} />
			</div>
			<Button type="button" variant="ghost" size="icon" aria-label={`Remove step ${String(index + 1)}`} onClick={remove}>
				<Trash2 className="size-4" />
			</Button>
		</div>
	);
}

function ScheduledStepsEditor({
	id,
	steps,
	onChange,
}: {
	readonly id: string;
	readonly steps: readonly RolloutStepInput[];
	readonly onChange: (rollout: Rollout) => void;
}): React.JSX.Element {
	const addStep = React.useCallback((): void => {
		onChange({ kind: "SCHEDULED", steps: withNextStep(steps, Date.now()) });
	}, [onChange, steps]);
	return (
		<div className="flex flex-col gap-2">
			{steps.map((step, index): React.JSX.Element => (
				<StepRow key={`${id}-step-${String(index)}-${String(step.at)}`} id={id} index={index} steps={steps} onChange={onChange} />
			))}
			<div>
				<Button type="button" variant="outline" size="sm" onClick={addStep}>
					<Plus className="size-4" />
					Add a step
				</Button>
			</div>
		</div>
	);
}

/** A matched rule's share: fixed, or steps at set times (the share is worked out from the clock). */
export function RolloutEditor({ id, rollout, onChange }: RolloutEditorProps): React.JSX.Element {
	const changeKind = React.useCallback(
		(kind: Rollout["kind"]): void => {
			onChange(kind === "FIXED" ? { kind, percentage: PERCENTAGE_MAX } : { kind, steps: firstRamp(Date.now()) });
		},
		[onChange],
	);
	return (
		<div className="flex flex-col gap-3">
			<OptionSelectField id={`${id}-kind`} label="Who of them gets it" value={rollout.kind} options={ROLLOUT_KINDS} labelOf={kindLabel} onChange={changeKind} />
			{rollout.kind === "FIXED" ? (
				<FixedShareEditor id={id} percentage={rollout.percentage} onChange={onChange} />
			) : (
				<ScheduledStepsEditor id={id} steps={rollout.steps} onChange={onChange} />
			)}
		</div>
	);
}
