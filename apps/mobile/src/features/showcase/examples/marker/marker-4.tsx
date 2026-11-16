import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui-native/components/marker";
import CodeIcon from "lucide-react-native/icons/code";
import FileTextIcon from "lucide-react-native/icons/file-text";
import FlaskConicalIcon from "lucide-react-native/icons/flask-conical";
import GitBranchIcon from "lucide-react-native/icons/git-branch";
import ListChecksIcon from "lucide-react-native/icons/list-checks";
import PencilIcon from "lucide-react-native/icons/pencil";
import SearchIcon from "lucide-react-native/icons/search";
import TerminalIcon from "lucide-react-native/icons/terminal";
import * as React from "react";
import { View } from "react-native";

interface Step {
	readonly id: string;
	readonly label: string;
	readonly icon: LucideIcon;
}

interface Phase {
	readonly name: string;
	readonly steps: readonly Step[];
}

const PHASES: readonly Phase[] = [
	{
		name: "Plan",
		steps: [
			{ id: "scan", label: "Searched 214 files for rateLimit(", icon: SearchIcon },
			{ id: "read", label: "Read src/lib/rate-limit.ts", icon: FileTextIcon },
			{ id: "outline", label: "Drafted a 3 step plan", icon: ListChecksIcon },
		],
	},
	{
		name: "Edit",
		steps: [
			{ id: "window", label: "Widened the window to 60s", icon: PencilIcon },
			{ id: "route", label: "Wired the limiter into the send route", icon: CodeIcon },
			{ id: "commit", label: "Committed to fix/rate-limit-window", icon: GitBranchIcon },
		],
	},
	{
		name: "Verify",
		steps: [
			{ id: "tests", label: "Ran pnpm test rate-limit", icon: TerminalIcon },
			{ id: "probe", label: "Confirmed the 429 no longer fires", icon: FlaskConicalIcon },
		],
	},
];

const TITLE = "Agent run";
const DESCRIPTION = "auth-rate-limit, 1m 48s";

// Phases are flat siblings in one column: the divider keeps the steps' rhythm, and its name reads right before its steps.
export function Marker4Example(): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
				<CardDescription>{DESCRIPTION}</CardDescription>
			</CardHeader>
			<CardContent>
				<View className="gap-2">
					{PHASES.map((phase: Phase): React.JSX.Element => (
						<React.Fragment key={phase.name}>
							<Marker variant="separator">
								<MarkerContent>{phase.name}</MarkerContent>
							</Marker>
							{phase.steps.map((step: Step): React.JSX.Element => (
								<Marker key={step.id}>
									<MarkerIcon>
										<Icon icon={step.icon} size="sm" colorClassName="accent-muted-foreground" />
									</MarkerIcon>
									<MarkerContent>{step.label}</MarkerContent>
								</Marker>
							))}
						</React.Fragment>
					))}
				</View>
			</CardContent>
		</Card>
	);
}
