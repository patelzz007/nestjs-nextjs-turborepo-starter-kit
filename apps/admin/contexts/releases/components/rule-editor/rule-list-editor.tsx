"use client";

import {
	ConditionAttributeSchema,
	PERCENTAGE_MAX,
	type ConditionAttribute,
	type ConditionInput,
	type FlagRule,
	type FlagRuleInput,
	type RolloutInput,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { OptionSelectField } from "@/components/common/form-fields";

import { CONDITION_ATTRIBUTE_LABELS } from "../../lib/release-labels";
import { ConditionEditor, emptyCondition } from "./condition-editor";
import { RolloutEditor } from "./rollout-editor";

/** One position up or down the list. */
const UP = -1;
const DOWN = 1;

/** A new flag rule: everyone, fully on. */
export function newFlagRule(index: number): FlagRule {
	return { id: crypto.randomUUID(), name: `Rule ${String(index + 1)}`, conditions: [], rollout: { kind: "FIXED", percentage: PERCENTAGE_MAX } };
}

/** `items` with the one at `index` moved by `step` (−1 up, +1 down); unchanged at either end. */
export function moved<T>(items: readonly T[], index: number, step: number): T[] {
	const target = index + step;
	const item = items.at(index);
	if (item === undefined || target < 0 || target >= items.length) {
		return [...items];
	}
	const rest = items.filter((_item, position) => position !== index);
	return [...rest.slice(0, target), item, ...rest.slice(target)];
}

function attributeLabel(attribute: ConditionAttribute): string {
	return CONDITION_ATTRIBUTE_LABELS[attribute];
}

/** A config's rules also pick a value: which names there are, and reading and setting a rule's. */
export interface ValueChoice<TRule> {
	readonly names: readonly string[];
	readonly of: (rule: TRule) => string;
	readonly set: (rule: TRule, name: string) => TRule;
}

export interface RuleListEditorProps<TRule extends FlagRuleInput> {
	readonly rules: readonly TRule[];
	readonly onChange: (rules: TRule[]) => void;
	readonly groupKeys: readonly string[];
	/** A fresh rule at a position (a flag's, or a config's with its first value). */
	readonly newRule: (index: number) => TRule;
	readonly valueChoice?: ValueChoice<TRule> | undefined;
}

export interface ConditionRowProps {
	readonly id: string;
	readonly index: number;
	readonly condition: ConditionInput;
	readonly groupKeys: readonly string[];
	readonly onReplace: (index: number, condition: ConditionInput) => void;
	readonly onRemove: (index: number) => void;
}

/** One condition of a rule (or a flag group): its kind, its controls, and removing it. */
export function ConditionRow({ id, index, condition, groupKeys, onReplace, onRemove }: ConditionRowProps): React.JSX.Element {
	const replace = React.useCallback(
		(next: ConditionInput): void => {
			onReplace(index, next);
		},
		[index, onReplace],
	);
	const remove = React.useCallback((): void => {
		onRemove(index);
	}, [index, onRemove]);
	const label = CONDITION_ATTRIBUTE_LABELS[condition.attribute];
	return (
		<div className="flex flex-col gap-2 rounded-lg border border-border p-3">
			<div className="flex items-center justify-between gap-2">
				<span className="text-sm font-medium">{label}</span>
				<Button type="button" variant="ghost" size="icon" aria-label={`Remove the ${label} condition`} onClick={remove}>
					<Trash2 className="size-4" />
				</Button>
			</div>
			<ConditionEditor id={`${id}-condition-${String(index)}`} condition={condition} groupKeys={groupKeys} onChange={replace} />
		</div>
	);
}

interface RuleCardProps<TRule extends FlagRuleInput> {
	readonly index: number;
	readonly rules: readonly TRule[];
	readonly onChange: (rules: TRule[]) => void;
	readonly groupKeys: readonly string[];
	readonly valueChoice: ValueChoice<TRule> | undefined;
}

/** One rule: its name, order, conditions, share and (a config's) value. */
function RuleCard<TRule extends FlagRuleInput>({ index, rules, onChange, groupKeys, valueChoice }: RuleCardProps<TRule>): React.JSX.Element | null {
	const rule = rules.at(index);
	const [nextAttribute, setNextAttribute] = React.useState<ConditionAttribute>("FLAG_GROUP");
	// With no groups yet, a group condition starts empty and the form asks for one before saving.
	const [firstGroup = ""] = groupKeys;
	const update = React.useCallback(
		(next: TRule): void => {
			onChange(rules.map((existing, position) => (position === index ? next : existing)));
		},
		[index, onChange, rules],
	);
	const setName = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			if (rule !== undefined) {
				update({ ...rule, name: event.target.value });
			}
		},
		[rule, update],
	);
	const moveUp = React.useCallback((): void => {
		onChange(moved(rules, index, UP));
	}, [index, onChange, rules]);
	const moveDown = React.useCallback((): void => {
		onChange(moved(rules, index, DOWN));
	}, [index, onChange, rules]);
	const remove = React.useCallback((): void => {
		onChange(rules.filter((_existing, position) => position !== index));
	}, [index, onChange, rules]);
	const replaceCondition = React.useCallback(
		(conditionIndex: number, next: ConditionInput): void => {
			if (rule !== undefined) {
				update({ ...rule, conditions: rule.conditions.map((existing, position) => (position === conditionIndex ? next : existing)) });
			}
		},
		[rule, update],
	);
	const removeCondition = React.useCallback(
		(conditionIndex: number): void => {
			if (rule !== undefined) {
				update({ ...rule, conditions: rule.conditions.filter((_existing, position) => position !== conditionIndex) });
			}
		},
		[rule, update],
	);
	const addCondition = React.useCallback((): void => {
		if (rule !== undefined) {
			update({ ...rule, conditions: [...rule.conditions, emptyCondition(nextAttribute, firstGroup)] });
		}
	}, [firstGroup, nextAttribute, rule, update]);
	const setRollout = React.useCallback(
		(rollout: RolloutInput): void => {
			if (rule !== undefined) {
				update({ ...rule, rollout });
			}
		},
		[rule, update],
	);
	const setValue = React.useCallback(
		(name: string): void => {
			if (rule !== undefined && valueChoice !== undefined) {
				update(valueChoice.set(rule, name));
			}
		},
		[rule, update, valueChoice],
	);
	if (rule === undefined) {
		return null;
	}
	const ruleId = `rule-${rule.id}`;
	return (
		<Card>
			<CardContent className="flex flex-col gap-4 pt-6">
				<div className="flex flex-wrap items-end gap-2">
					<div className="min-w-56 flex-1 space-y-1.5">
						<Label htmlFor={`${ruleId}-name`}>{`Rule ${String(index + 1)}`}</Label>
						<Input id={`${ruleId}-name`} value={rule.name} onChange={setName} />
					</div>
					<Button type="button" variant="ghost" size="icon" aria-label="Move up" disabled={index === 0} onClick={moveUp}>
						<ArrowUp className="size-4" />
					</Button>
					<Button type="button" variant="ghost" size="icon" aria-label="Move down" disabled={index === rules.length - 1} onClick={moveDown}>
						<ArrowDown className="size-4" />
					</Button>
					<Button type="button" variant="ghost" size="icon" aria-label={`Remove ${rule.name}`} onClick={remove}>
						<Trash2 className="size-4" />
					</Button>
				</div>
				<fieldset className="flex flex-col gap-3">
					<legend className="text-sm font-medium">{rule.conditions.length === 0 ? "Matches everyone" : "Matches when all of these hold"}</legend>
					{rule.conditions.map((condition, conditionIndex): React.JSX.Element => (
						<ConditionRow
							key={`${rule.id}-${String(conditionIndex)}`}
							id={ruleId}
							index={conditionIndex}
							condition={condition}
							groupKeys={groupKeys}
							onReplace={replaceCondition}
							onRemove={removeCondition}
						/>
					))}
					<div className="flex flex-wrap items-end gap-2">
						<div className="min-w-56">
							<OptionSelectField
								id={`${ruleId}-next`}
								label="Add a condition on"
								value={nextAttribute}
								options={ConditionAttributeSchema.options}
								labelOf={attributeLabel}
								onChange={setNextAttribute}
							/>
						</div>
						<Button type="button" variant="outline" size="sm" onClick={addCondition}>
							<Plus className="size-4" />
							Add condition
						</Button>
					</div>
				</fieldset>
				<RolloutEditor id={`${ruleId}-rollout`} rollout={rule.rollout} onChange={setRollout} />
				{valueChoice === undefined ? null : (
					<OptionSelectField id={`${ruleId}-value`} label="They get" value={valueChoice.of(rule)} options={valueChoice.names} onChange={setValue} />
				)}
			</CardContent>
		</Card>
	);
}

/** The ordered rules of a flag or config (controlled: the form owns the value). The first a subject matches decides. */
export function RuleListEditor<TRule extends FlagRuleInput>({ rules, onChange, groupKeys, newRule, valueChoice }: RuleListEditorProps<TRule>): React.JSX.Element {
	const addRule = React.useCallback((): void => {
		onChange([...rules, newRule(rules.length)]);
	}, [newRule, onChange, rules]);
	return (
		<div className="flex flex-col gap-4">
			{rules.length === 0 ? <p className="text-sm text-muted-foreground">No rules: everyone gets the code default.</p> : null}
			{rules.map((rule, index): React.JSX.Element => (
				<RuleCard key={rule.id} index={index} rules={rules} onChange={onChange} groupKeys={groupKeys} valueChoice={valueChoice} />
			))}
			<div>
				<Button type="button" variant="outline" onClick={addRule}>
					<Plus className="size-4" />
					Add a rule
				</Button>
			</div>
		</div>
	);
}
