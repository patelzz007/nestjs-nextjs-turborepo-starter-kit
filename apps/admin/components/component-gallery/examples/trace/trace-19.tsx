"use client";

import { BanIcon, CircleCheckIcon, CircleDashedIcon, KeyRoundIcon } from "lucide-react";
import * as React from "react";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceDescription,
	TraceIcon,
	TraceLine,
	TraceTitle,
	type TraceLineStatus,
} from "@workspace/ui/components/trace";

type Role = "viewer" | "billing" | "admin";

interface Member {
	readonly value: string;
	readonly label: string;
	readonly firstName: string;
	readonly role: Role;
	readonly mfa: boolean;
}

interface Resource {
	readonly value: string;
	readonly label: string;
	readonly roles: readonly Role[];
	readonly needsMfa: boolean;
	readonly sharedWith: readonly string[];
}

const MARIA: Member = { value: "maria", label: "Maria Lopez", firstName: "Maria", role: "viewer", mfa: true };

const MEMBERS: readonly Member[] = [
	MARIA,
	{ value: "sam", label: "Sam Okafor", firstName: "Sam", role: "billing", mfa: false },
	{ value: "priya", label: "Priya Shah", firstName: "Priya", role: "admin", mfa: true },
];

const BILLING_SETTINGS: Resource = {
	value: "billing",
	label: "Billing settings",
	roles: ["billing", "admin"],
	needsMfa: false,
	sharedWith: [],
};

const RESOURCES: readonly Resource[] = [
	BILLING_SETTINGS,
	{
		value: "keys",
		label: "API keys",
		roles: ["admin"],
		needsMfa: true,
		sharedWith: [],
	},
	{
		value: "deck",
		label: "Q3 board deck",
		roles: ["admin"],
		needsMfa: false,
		sharedWith: [MARIA.value],
	},
];

const ROLE_NAMES: Readonly<Record<Role, string>> = {
	viewer: "Viewer",
	billing: "Billing admin",
	admin: "Admin",
};

type Verdict = "allow" | "deny" | "pass" | "skipped";

interface Rule {
	readonly id: string;
	readonly text: string;
	readonly verdict: Verdict;
}

interface Evaluation {
	readonly rules: readonly Rule[];
	readonly allowed: boolean;
	readonly member: Member;
	readonly resource: Resource;
}

// The icon is hidden from assistive tech, so the deciding rule says so in words.
const VERDICT_PREFIX: Readonly<Record<Verdict, string>> = {
	allow: "Allowed: ",
	deny: "Denied: ",
	pass: "",
	skipped: "Not reached: ",
};

const VERDICT_STATUS: Readonly<Record<Verdict, TraceLineStatus | undefined>> = {
	allow: undefined,
	deny: "error",
	pass: undefined,
	skipped: "pending",
};

function isDecisive(verdict: Verdict): boolean {
	return verdict === "allow" || verdict === "deny";
}

// Rules run in order and the first allow or deny decides. Everything after the
// deciding rule is still listed, as pending, so a reader sees which rules never
// got a say instead of wondering whether they were checked.
function evaluate(memberId: string, resourceId: string): Evaluation {
	const member = MEMBERS.find((candidate: Member): boolean => candidate.value === memberId) ?? MARIA;
	const resource = RESOURCES.find((candidate: Resource): boolean => candidate.value === resourceId) ?? BILLING_SETTINGS;
	const { firstName } = member;
	const checks: Rule[] = [{ id: "member", text: `${firstName} is a member of Northwind`, verdict: "pass" }];

	if (resource.needsMfa) {
		checks.push({
			id: "mfa",
			text: member.mfa ? `Needs 2FA, and ${firstName} has it on` : `Needs 2FA, and ${firstName} has it off`,
			verdict: member.mfa ? "pass" : "deny",
		});
	}

	const shared = resource.sharedWith.includes(member.value);
	checks.push({
		id: "share",
		text: shared ? `Shared with ${firstName} directly` : `Not shared with ${firstName} directly`,
		verdict: shared ? "allow" : "pass",
	});

	const roleAllowed = resource.roles.includes(member.role);
	const role = ROLE_NAMES[member.role];
	checks.push({
		id: "role",
		text: roleAllowed ? `The ${role} role can open ${resource.label}` : `Needs ${resource.roles.map((name: Role): string => ROLE_NAMES[name]).join(" or ")}, not ${role}`,
		verdict: roleAllowed ? "allow" : "deny",
	});

	const decidedAt = checks.findIndex((check: Rule): boolean => isDecisive(check.verdict));
	const rules = checks.map((check: Rule, index: number): Rule => (index > decidedAt ? { ...check, verdict: "skipped" } : check));
	const deciding = checks.at(decidedAt);
	return { rules, allowed: deciding?.verdict === "allow", member, resource };
}

/** "Denied: " + "Needs Admin…" → "Denied: needs Admin…". */
function ruleTitle(rule: Rule): string {
	const prefix = VERDICT_PREFIX[rule.verdict];
	if (prefix === "") {
		return rule.text;
	}
	return `${prefix}${rule.text.charAt(0).toLowerCase()}${rule.text.slice(1)}`;
}

export function Trace19Example(): React.JSX.Element {
	const [memberId, setMemberId] = React.useState(MARIA.value);
	const [resourceId, setResourceId] = React.useState(BILLING_SETTINGS.value);
	const { rules, allowed, member, resource } = evaluate(memberId, resourceId);
	const verdict = `${member.firstName} ${allowed ? "can open" : "cannot open"} ${resource.label}`;

	const handleMemberChange = React.useCallback((value: string | null): void => {
		if (value !== null) {
			setMemberId(value);
		}
	}, []);

	const handleResourceChange = React.useCallback((value: string | null): void => {
		if (value !== null) {
			setResourceId(value);
		}
	}, []);

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<div className="grid grid-cols-2 gap-3">
				<Field>
					<FieldLabel htmlFor="access-member">Member</FieldLabel>
					<Select items={MEMBERS} value={memberId} onValueChange={handleMemberChange}>
						<SelectTrigger id="access-member" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{MEMBERS.map((item: Member): React.JSX.Element => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor="access-page">Page</FieldLabel>
					<Select items={RESOURCES} value={resourceId} onValueChange={handleResourceChange}>
						<SelectTrigger id="access-page" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{RESOURCES.map((item: Resource): React.JSX.Element => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			</div>
			<Trace>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger>
						<TraceLine status={allowed ? undefined : "error"}>
							<TraceIcon>
								<VerdictGlyph verdict={allowed ? "allow" : "deny"} />
							</TraceIcon>
							<TraceTitle>{verdict}</TraceTitle>
							<TraceDescription>{rules.length} rules</TraceDescription>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<Trace>
							{rules.map((rule: Rule): React.JSX.Element => (
								<TraceLine key={rule.id} status={VERDICT_STATUS[rule.verdict]}>
									<TraceIcon>
										<VerdictGlyph verdict={rule.verdict} />
									</TraceIcon>
									<TraceTitle>{ruleTitle(rule)}</TraceTitle>
								</TraceLine>
							))}
						</Trace>
					</TraceCollapsibleContent>
				</TraceCollapsible>
			</Trace>
			{/* Only the verdict is live; re-reading every rule on each change
			    would bury it. */}
			<p role="status" className="sr-only">
				{verdict}
			</p>
		</div>
	);
}

interface VerdictGlyphProps {
	readonly verdict: Verdict;
}

function VerdictGlyph({ verdict }: VerdictGlyphProps): React.JSX.Element {
	if (verdict === "deny") {
		return <BanIcon />;
	}
	if (verdict === "allow") {
		return <KeyRoundIcon />;
	}
	if (verdict === "skipped") {
		return <CircleDashedIcon />;
	}
	return <CircleCheckIcon />;
}
