import { ChartLineIcon, ChevronRightIcon, DatabaseIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { CodeBlock } from "@workspace/ui/components/code-block";
import { Message, MessageContent } from "@workspace/ui/components/message";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

import { ROUTES } from "@/lib/routes";

interface Query {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly sql: string;
}

interface Dashboard {
	readonly title: string;
	readonly href: string;
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

// The sources link to this admin's own pages: the analytics dashboard and the
// email delivery log.
const DASHBOARDS: readonly Dashboard[] = [
	{ title: "Activation funnel, weekly", href: ROUTES.analytics.index },
	{ title: "Email delivery health", href: ROUTES.emails.log },
];

// The work folds into one row above the answer and the sources sit below it.
// keepMounted keeps an opened query open when the summary folds.
export function Trace3Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-md flex-col gap-6 text-sm">
			<Message align="end">
				<MessageContent>
					<Bubble align="end" variant="muted">
						<BubbleContent>Why did trial signups drop last Tuesday?</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
			<Message>
				<MessageContent>
					<div className="flex flex-col gap-4">
						<Trace>
							<TraceCollapsible defaultOpen>
								<TraceCollapsibleTrigger>
									<TraceLine>
										<TraceTitle>Worked for 38s</TraceTitle>
										<TraceDescription>{QUERIES.length} queries</TraceDescription>
									</TraceLine>
								</TraceCollapsibleTrigger>
								<TraceCollapsibleContent keepMounted>
									<Trace>
										{QUERIES.map((query: Query): React.JSX.Element => (
											<TraceCollapsible key={query.id}>
												<TraceCollapsibleTrigger>
													<TraceLine>
														<TraceIcon>
															<DatabaseIcon />
														</TraceIcon>
														<TraceTitle>{query.title}</TraceTitle>
														<TraceDescription>{query.description}</TraceDescription>
													</TraceLine>
												</TraceCollapsibleTrigger>
												<TraceCollapsibleContent>
													<CodeBlock code={query.sql} language="sql" label={query.title} wrap />
												</TraceCollapsibleContent>
											</TraceCollapsible>
										))}
									</Trace>
								</TraceCollapsibleContent>
							</TraceCollapsible>
						</Trace>
						<p className="leading-relaxed text-pretty">Signups fell 41% because verification emails to Gmail bounced for 4 hours after the DKIM record broke.</p>
						<Trace>
							<TraceCollapsible>
								<TraceCollapsibleTrigger>
									<TraceLine>
										<TraceIcon>
											<ChartLineIcon />
										</TraceIcon>
										<TraceTitle>Used {DASHBOARDS.length} dashboards</TraceTitle>
									</TraceLine>
								</TraceCollapsibleTrigger>
								<TraceCollapsibleContent>
									<Trace>
										{DASHBOARDS.map((dashboard: Dashboard): React.JSX.Element => (
											<Link key={dashboard.title} href={dashboard.href}>
												<TraceLine>
													<TraceTitle>{dashboard.title}</TraceTitle>
													<TraceIcon>
														<ChevronRightIcon />
													</TraceIcon>
												</TraceLine>
											</Link>
										))}
									</Trace>
								</TraceCollapsibleContent>
							</TraceCollapsible>
						</Trace>
					</div>
				</MessageContent>
			</Message>
		</div>
	);
}
