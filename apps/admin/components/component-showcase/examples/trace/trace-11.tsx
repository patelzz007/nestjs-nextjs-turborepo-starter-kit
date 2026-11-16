import { BugIcon, ChevronRightIcon, GlobeIcon, MousePointer2Icon, NavigationIcon } from "lucide-react";
import type * as React from "react";

import { CodeBlock, type CodeBlockLevelSpec, type CodeBlockLineSpec } from "@workspace/ui/components/code-block";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

const RESPONSE = `{
  "interval": "year",
  "plans": [
    {
      "id": "pro",
      "prices": {
        "month": { "priceId": "price_1Q8sZ7" },
        "year": { "priceId": "price_1Q8sZ9" }
      }
    },
    {
      "id": "team",
      "prices": {
        "month": { "priceId": "price_1Q8t02" }
      }
    }
  ]
}`;

/** The team plan, which has no yearly price, by line of the response body. */
const TEAM_PLAN_LINES: CodeBlockLineSpec = [13, 14, 15];

const FRAME = `export function CheckoutButton({ plan }: Props) {
  const { interval } = useBilling()
  const price = plan.prices[interval]
  const priceId = price.priceId
  return <Button onClick={() => checkout(priceId)}>Upgrade</Button>
}`;

/** The frame excerpt opens at this line of checkout-button.tsx. */
const FRAME_START_LINE = 11;
/** `price.priceId` on an undefined price, by line of the excerpt. */
const FRAME_LEVELS: CodeBlockLevelSpec = { error: [4] };

const FRAMEWORK_FRAMES: readonly string[] = ["renderWithHooks", "updateFunctionComponent", "beginWork", "performUnitOfWork", "workLoopSync"];

// The failing request opens in a dialog: its JSON body is too long to expand
// between one-line events.
export function Trace11Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Trace>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceTitle>Breadcrumbs</TraceTitle>
							<TraceDescription>4 events</TraceDescription>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<Trace>
							<TraceLine>
								<TraceIcon>
									<NavigationIcon />
								</TraceIcon>
								<TraceTitle>Navigated from / to /pricing</TraceTitle>
								<TraceDescription>14:31:02.118</TraceDescription>
							</TraceLine>
							<Dialog>
								<DialogTrigger>
									<TraceLine>
										<TraceIcon>
											<GlobeIcon />
										</TraceIcon>
										<TraceTitle>GET /api/plans?interval=year, 200</TraceTitle>
										<TraceDescription>14:31:05.611</TraceDescription>
										<TraceIcon>
											<ChevronRightIcon />
										</TraceIcon>
									</TraceLine>
								</DialogTrigger>
								<DialogContent className="sm:max-w-md">
									<DialogHeader>
										<DialogTitle>GET /api/plans?interval=year</DialogTitle>
										<DialogDescription>200 in 209 ms. The team plan has no yearly price.</DialogDescription>
									</DialogHeader>
									<CodeBlock code={RESPONSE} language="json" highlightedLines={TEAM_PLAN_LINES} label="Response body" />
								</DialogContent>
							</Dialog>
							<TraceLine>
								<TraceIcon>
									<MousePointer2Icon />
								</TraceIcon>
								<TraceTitle>Clicked Upgrade on Team</TraceTitle>
								<TraceDescription>14:31:09.023</TraceDescription>
							</TraceLine>
							<TraceLine status="error">
								<TraceIcon>
									<BugIcon />
								</TraceIcon>
								<TraceTitle>Threw TypeError in CheckoutButton</TraceTitle>
								<TraceDescription>14:31:09.024</TraceDescription>
							</TraceLine>
						</Trace>
					</TraceCollapsibleContent>
				</TraceCollapsible>
				<TraceCollapsible>
					<TraceCollapsibleTrigger>
						<TraceLine>
							<TraceTitle>Stack trace</TraceTitle>
							<TraceDescription>1 in app, 5 framework</TraceDescription>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<Trace>
							<TraceCollapsible defaultOpen>
								<TraceCollapsibleTrigger>
									<TraceLine status="error">
										<TraceTitle>
											<code className="text-xs">CheckoutButton</code>
										</TraceTitle>
										<TraceDescription>
											<code className="text-xs">checkout-button.tsx:14:25</code>
										</TraceDescription>
									</TraceLine>
								</TraceCollapsibleTrigger>
								<TraceCollapsibleContent>
									<CodeBlock code={FRAME} language="tsx" showLineNumbers startLine={FRAME_START_LINE} lineLevels={FRAME_LEVELS} label="checkout-button.tsx around line 14" />
								</TraceCollapsibleContent>
							</TraceCollapsible>
							{/* Framework frames fold into one row: they are real, but
                    rarely where the fix is. */}
							<TraceCollapsible>
								<TraceCollapsibleTrigger>
									<TraceLine>
										<TraceTitle>{FRAMEWORK_FRAMES.length} frames in react-dom</TraceTitle>
									</TraceLine>
								</TraceCollapsibleTrigger>
								<TraceCollapsibleContent>
									<Trace>
										{FRAMEWORK_FRAMES.map((frame: string): React.JSX.Element => (
											<TraceLine key={frame}>
												<TraceTitle>
													<code className="text-xs">{frame}</code>
												</TraceTitle>
											</TraceLine>
										))}
									</Trace>
								</TraceCollapsibleContent>
							</TraceCollapsible>
						</Trace>
					</TraceCollapsibleContent>
				</TraceCollapsible>
			</Trace>
		</div>
	);
}
