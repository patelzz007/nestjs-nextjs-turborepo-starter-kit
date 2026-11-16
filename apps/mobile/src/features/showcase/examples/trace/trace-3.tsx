import { Bubble } from "@workspace/ui-native/components/bubble";
import { CodeBlock } from "@workspace/ui-native/components/code-block";
import { Message } from "@workspace/ui-native/components/message";
import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
import ChartLineIcon from "lucide-react-native/icons/chart-line";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import DatabaseIcon from "lucide-react-native/icons/database";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

interface Query {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly sql: string;
}

const QUERIES: readonly Query[] = [
	{
		id: "by-day",
		title: "Queried trial signups by day",
		description: "28 rows",
		sql: `select date_trunc('day', created_at) as day, count(*)
from trials
where created_at >= current_date - 27
group by 1 order by 1`,
	},
	{
		id: "by-domain",
		title: "Queried bounces by email domain",
		description: "12 rows",
		sql: `select split_part(email, '@', 2) as domain, count(*)
from verification_attempts
where status = 'bounced' and created_at::date = '2026-10-06'
group by 1 order by 2 desc limit 12`,
	},
];

const DASHBOARDS: readonly string[] = ["Activation funnel, weekly", "Email delivery health"];

const ANSWER = "Signups fell 41% because verification emails to Gmail bounced for 4 hours after the DKIM record broke.";

// A chat turn: the work folds into one summary row above the answer, the sources below it.
export function Trace3Example(): React.JSX.Element {
	return (
		<View className="gap-6">
			<Message variant="sent">
				<Bubble variant="sent" text="Why did trial signups drop last Tuesday?" />
			</Message>
			<Message>
				<View className="gap-4">
					<Trace>
						<TraceStep title="Worked for 38s" description={`${String(QUERIES.length)} queries`} defaultOpen>
							<Trace>
								{QUERIES.map((query: Query): React.JSX.Element => (
									<TraceStep key={query.id} icon={DatabaseIcon} title={query.title} description={query.description}>
										<CodeBlock code={query.sql} language="sql" caption={query.title} wrap />
									</TraceStep>
								))}
							</Trace>
						</TraceStep>
					</Trace>
					<Text className="text-body font-sans text-foreground">{ANSWER}</Text>
					<Trace>
						<TraceStep icon={ChartLineIcon} title={`Used ${String(DASHBOARDS.length)} dashboards`}>
							<Trace>
								{DASHBOARDS.map((dashboard: string): React.JSX.Element => (
									<TraceLine key={dashboard} title={dashboard} trailingIcon={ChevronRightIcon} accessibilityRole="link" onPress={ignorePress} />
								))}
							</Trace>
						</TraceStep>
					</Trace>
				</View>
			</Message>
		</View>
	);
}
