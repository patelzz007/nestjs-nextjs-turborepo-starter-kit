import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import { Trace, TraceLine, TraceStep, type TraceLineStatus } from "@workspace/ui-native/components/trace";
import BanIcon from "lucide-react-native/icons/ban";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CircleDashedIcon from "lucide-react-native/icons/circle-dashed";
import KeyRoundIcon from "lucide-react-native/icons/key-round";
import * as React from "react";
import { AccessibilityInfo, View } from "react-native";

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

const BILLING_SETTINGS: Resource = { value: "billing", label: "Billing settings", roles: ["billing", "admin"], needsMfa: false, sharedWith: [] };

const RESOURCES: readonly Resource[] = [
	BILLING_SETTINGS,
	{ value: "keys", label: "API keys", roles: ["admin"], needsMfa: true, sharedWith: [] },
	{ value: "deck", label: "Q3 board deck", roles: ["admin"], needsMfa: false, sharedWith: [MARIA.value] },
];

const MEMBER_OPTIONS: readonly SelectOption<string>[] = MEMBERS.map((member: Member): SelectOption<string> => ({ value: member.value, label: member.label }));
const RESOURCE_OPTIONS: readonly SelectOption<string>[] = RESOURCES.map((resource: Resource): SelectOption<string> => ({ value: resource.value, label: resource.label }));

const ROLE_NAMES: Readonly<Record<Role, string>> = { viewer: "Viewer", billing: "Billing admin", admin: "Admin" };

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

/** The glyph is decorative, so the deciding rule says so in words. */
const VERDICT_PREFIX: Readonly<Record<Verdict, string>> = { allow: "Allowed: ", deny: "Denied: ", pass: "", skipped: "Not reached: " };
const VERDICT_STATUS: Readonly<Record<Verdict, TraceLineStatus | undefined>> = { allow: undefined, deny: "error", pass: undefined, skipped: "pending" };
const VERDICT_GLYPHS: Readonly<Record<Verdict, LucideIcon>> = { allow: KeyRoundIcon, deny: BanIcon, pass: CircleCheckIcon, skipped: CircleDashedIcon };

function isDecisive(verdict: Verdict): boolean {
	return verdict === "allow" || verdict === "deny";
}

// Rules run in order and the first allow or deny decides. Everything after it is still listed, as pending,
// so a reader sees which rules never got a say instead of wondering whether they were checked.
function evaluate(memberId: string | null, resourceId: string | null): Evaluation {
	const member = MEMBERS.find((candidate: Member): boolean => candidate.value === memberId) ?? MARIA;
	const resource = RESOURCES.find((candidate: Resource): boolean => candidate.value === resourceId) ?? BILLING_SETTINGS;
	const { firstName } = member;
	const checks: Rule[] = [{ id: "member", text: `${firstName} is a member of Northwind`, verdict: "pass" }];
	if (resource.needsMfa) {
		checks.push({ id: "mfa", text: member.mfa ? `Needs 2FA, and ${firstName} has it on` : `Needs 2FA, and ${firstName} has it off`, verdict: member.mfa ? "pass" : "deny" });
	}
	const shared = resource.sharedWith.includes(member.value);
	checks.push({ id: "share", text: shared ? `Shared with ${firstName} directly` : `Not shared with ${firstName} directly`, verdict: shared ? "allow" : "pass" });
	const roleAllowed = resource.roles.includes(member.role);
	const role = ROLE_NAMES[member.role];
	checks.push({
		id: "role",
		text: roleAllowed ? `The ${role} role can open ${resource.label}` : `Needs ${resource.roles.map((name: Role): string => ROLE_NAMES[name]).join(" or ")}, not ${role}`,
		verdict: roleAllowed ? "allow" : "deny",
	});
	const decidedAt = checks.findIndex((check: Rule): boolean => isDecisive(check.verdict));
	const rules = checks.map((check: Rule, index: number): Rule => (index > decidedAt ? { ...check, verdict: "skipped" } : check));
	return { rules, allowed: checks.at(decidedAt)?.verdict === "allow", member, resource };
}

/** "Denied: " + "Needs Admin…" reads "Denied: needs Admin…". */
function ruleTitle(rule: Rule): string {
	const prefix = VERDICT_PREFIX[rule.verdict];
	if (prefix === "") {
		return rule.text;
	}
	return `${prefix}${rule.text.charAt(0).toLowerCase()}${rule.text.slice(1)}`;
}

export function Trace19Example(): React.JSX.Element {
	const [memberId, setMemberId] = React.useState<string | null>(MARIA.value);
	const [resourceId, setResourceId] = React.useState<string | null>(BILLING_SETTINGS.value);
	const { rules, allowed, member, resource } = evaluate(memberId, resourceId);
	const verdict = `${member.firstName} ${allowed ? "can open" : "cannot open"} ${resource.label}`;

	// Only the verdict is announced: re-reading every rule on each change would bury it.
	React.useEffect((): void => {
		AccessibilityInfo.announceForAccessibility(verdict);
	}, [verdict]);

	return (
		<View className="gap-4">
			<View className="flex-row gap-3">
				<SelectField label="Member" options={MEMBER_OPTIONS} value={memberId} onChange={setMemberId} className="flex-1" />
				<SelectField label="Page" options={RESOURCE_OPTIONS} value={resourceId} onChange={setResourceId} className="flex-1" />
			</View>
			<Trace>
				<TraceStep
					icon={VERDICT_GLYPHS[allowed ? "allow" : "deny"]}
					title={verdict}
					description={`${String(rules.length)} rules`}
					status={allowed ? undefined : "error"}
					defaultOpen>
					<Trace>
						{rules.map((rule: Rule): React.JSX.Element => (
							<TraceLine key={rule.id} icon={VERDICT_GLYPHS[rule.verdict]} title={ruleTitle(rule)} status={VERDICT_STATUS[rule.verdict]} />
						))}
					</Trace>
				</TraceStep>
			</Trace>
		</View>
	);
}
