"use client";

import type { Condition, Rollout } from "@workspace/shared";
import * as React from "react";

import { describeCondition, describeRollout } from "../lib/release-labels";

/** A rule as this summary reads it: a flag's or a config's (which also names the value it gives). */
export interface SummarisedRule {
	readonly id: string;
	readonly name: string;
	readonly conditions: readonly Condition[];
	readonly rollout: Rollout;
	readonly valueName?: string;
}

export interface RulesSummaryProps {
	readonly rules: readonly SummarisedRule[];
	/** What a subject no rule matches gets: "Off (the code default)". */
	readonly fallback: string;
	readonly now: number;
}

/** A revision's rules, read-only, in the order they are tried: the first one a subject matches decides. */
export function RulesSummary({ rules, fallback, now }: RulesSummaryProps): React.JSX.Element {
	return (
		<ol className="flex flex-col gap-3">
			{rules.map((rule, index): React.JSX.Element => (
				<li key={rule.id} className="rounded-lg border border-border p-3">
					<p className="text-sm font-medium">
						<span className="mr-2 text-muted-foreground tabular-nums">{String(index + 1)}.</span>
						{rule.name}
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						{rule.conditions.length === 0 ? "Everyone" : rule.conditions.map(describeCondition).join(" and ")}
						{" → "}
						{describeRollout(rule.rollout, now)}
						{rule.valueName === undefined ? "" : ` get ${rule.valueName}`}
					</p>
				</li>
			))}
			<li className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">Everyone else: {fallback}</li>
		</ol>
	);
}
