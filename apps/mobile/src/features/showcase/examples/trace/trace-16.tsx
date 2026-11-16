import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
import CornerDownRightIcon from "lucide-react-native/icons/corner-down-right";
import PackageIcon from "lucide-react-native/icons/package";
import ShieldAlertIcon from "lucide-react-native/icons/shield-alert";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import * as React from "react";
import { AccessibilityInfo, Text, View } from "react-native";

interface AdvisoryFix {
	readonly action: string;
	readonly done: string;
	readonly why: string;
}

interface Advisory {
	readonly id: string;
	readonly pkg: string;
	readonly version: string;
	readonly severity: "high" | "moderate";
	readonly kind: string;
	readonly issue: string;
	/** From apps/web down to the vulnerable package, before and after the fix. */
	readonly path: readonly string[];
	readonly fixedPath: readonly string[];
	readonly fix: AdvisoryFix;
}

const ADVISORIES: readonly Advisory[] = [
	{
		id: "CVE-2024-45296",
		pkg: "path-to-regexp",
		version: "0.1.7",
		severity: "high",
		kind: "ReDoS",
		issue: "Backtracking regex in route parsing, fixed in 0.1.10",
		path: ["express 4.19.2", "path-to-regexp 0.1.7"],
		fixedPath: ["express 4.20.0", "path-to-regexp 0.1.10"],
		fix: { action: "Upgrade express to 4.20.0", done: "Upgraded express to 4.20.0", why: "express 4.19.2 pins 0.1.7, so express itself has to move." },
	},
	{
		id: "CVE-2024-4068",
		pkg: "braces",
		version: "3.0.2",
		severity: "high",
		kind: "Memory exhaustion",
		issue: "No limit on input length, fixed in 3.0.3",
		path: ["lint-staged 15.2.2", "micromatch 4.0.5", "braces 3.0.2"],
		fixedPath: ["lint-staged 15.2.2", "micromatch 4.0.5", "braces 3.0.3"],
		fix: { action: "Update the lockfile", done: "Updated braces to 3.0.3", why: "micromatch asks for ^3.0.2, which already allows 3.0.3." },
	},
	{
		id: "CVE-2024-55565",
		pkg: "nanoid",
		version: "3.3.7",
		severity: "moderate",
		kind: "Predictable IDs",
		issue: "Non-integer sizes weaken the output, fixed in 3.3.8",
		path: ["postcss 8.4.38", "nanoid 3.3.7"],
		fixedPath: ["postcss 8.4.38", "nanoid 3.3.8"],
		fix: { action: "Update the lockfile", done: "Updated nanoid to 3.3.8", why: "postcss asks for ^3.3.7, which already allows 3.3.8." },
	},
];

function AdvisoryRow({ advisory, done, onFix }: { readonly advisory: Advisory; readonly done: boolean; readonly onFix: (advisory: Advisory) => void }): React.JSX.Element {
	const fix = React.useCallback((): void => {
		onFix(advisory);
	}, [advisory, onFix]);
	const title = done ? advisory.fix.done : `${advisory.kind} in ${advisory.pkg} ${advisory.version}`;
	const severity = done ? undefined : <Badge label={advisory.severity} tone={advisory.severity === "high" ? "destructive" : "warning"} variant="light" size="sm" />;
	return (
		<TraceStep icon={done ? ShieldCheckIcon : ShieldAlertIcon} title={title} trailing={severity} accessibilityLabel={done ? title : `${title}, ${advisory.severity} severity`}>
			<Text className="text-label font-sans text-muted-foreground">{`${advisory.issue}.`}</Text>
			<Trace>
				<TraceLine title="apps/web" />
				{(done ? advisory.fixedPath : advisory.path).map((step: string): React.JSX.Element => (
					<TraceLine key={step} icon={CornerDownRightIcon} title={step} />
				))}
			</Trace>
			{done ? (
				<Text className="text-label font-sans text-muted-foreground">{advisory.fix.why}</Text>
			) : (
				<View className="flex-row flex-wrap items-center gap-3">
					<Button label={advisory.fix.action} size="xs" variant="outline" onPress={fix} />
					<Text className="text-caption font-code text-muted-foreground">{advisory.id}</Text>
				</View>
			)}
		</TraceStep>
	);
}

// The chain decides the fix: a parent that pins the version needs an upgrade, a caret range only a lockfile update.
export function Trace16Example(): React.JSX.Element {
	const [fixed, setFixed] = React.useState<readonly string[]>([]);
	const open = ADVISORIES.filter((advisory: Advisory): boolean => !fixed.includes(advisory.id));
	const high = open.filter((advisory: Advisory): boolean => advisory.severity === "high").length;
	const fix = React.useCallback((advisory: Advisory): void => {
		setFixed((current: readonly string[]): readonly string[] => [...current, advisory.id]);
		// The row rewrites itself in place; say what changed.
		AccessibilityInfo.announceForAccessibility(advisory.fix.done);
	}, []);
	return (
		<Trace accessibilityLabel="Dependency audit">
			<TraceLine icon={PackageIcon} title="Audited 1,284 dependencies" description={open.length > 0 ? `${String(open.length)} open, ${String(high)} high` : "all fixed"} />
			{ADVISORIES.map((advisory: Advisory): React.JSX.Element => (
				<AdvisoryRow key={advisory.id} advisory={advisory} done={fixed.includes(advisory.id)} onFix={fix} />
			))}
		</Trace>
	);
}
