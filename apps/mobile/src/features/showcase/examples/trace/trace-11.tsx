import { CodeBlock, type CodeBlockLineMark } from "@workspace/ui-native/components/code-block";
import { Dialog, DialogBody, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
import BugIcon from "lucide-react-native/icons/bug";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import GlobeIcon from "lucide-react-native/icons/globe";
import MousePointer2Icon from "lucide-react-native/icons/mouse-pointer-2";
import NavigationIcon from "lucide-react-native/icons/navigation";
import * as React from "react";

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
const TEAM_PLAN_MARKS: readonly CodeBlockLineMark[] = [
	{ line: 13, kind: "highlight" },
	{ line: 14, kind: "highlight" },
	{ line: 15, kind: "highlight" },
];

const FRAME = `export function CheckoutButton({ plan }: Props) {
  const { interval } = useBilling()
  const price = plan.prices[interval]
  const priceId = price.priceId
  return <Button onClick={() => checkout(priceId)}>Upgrade</Button>
}`;

/** The frame excerpt opens at this line of checkout-button.tsx. */
const FRAME_START_LINE = 11;
/** `price.priceId` on an undefined price: line 14 of the file. */
const FRAME_MARKS: readonly CodeBlockLineMark[] = [{ line: 14, kind: "error" }];

const FRAMEWORK_FRAMES: readonly string[] = ["renderWithHooks", "updateFunctionComponent", "beginWork", "performUnitOfWork", "workLoopSync"];

const REQUEST = "GET /api/plans?interval=year";
const REQUEST_SUMMARY = "200 in 209 ms. The team plan has no yearly price.";

// The failing request opens in a dialog: its JSON body is too long to expand between one-line events.
export function Trace11Example(): React.JSX.Element {
	const [requestOpen, setRequestOpen] = React.useState(false);
	const showRequest = React.useCallback((): void => {
		setRequestOpen(true);
	}, []);
	return (
		<>
			<Trace>
				<TraceStep title="Breadcrumbs" description="4 events" defaultOpen>
					<Trace>
						<TraceLine icon={NavigationIcon} title="Navigated from / to /pricing" description="14:31:02.118" />
						<TraceLine icon={GlobeIcon} title={`${REQUEST}, 200`} description="14:31:05.611" trailingIcon={ChevronRightIcon} onPress={showRequest} />
						<TraceLine icon={MousePointer2Icon} title="Clicked Upgrade on Team" description="14:31:09.023" />
						<TraceLine icon={BugIcon} title="Threw TypeError in CheckoutButton" description="14:31:09.024" status="error" />
					</Trace>
				</TraceStep>
				<TraceStep title="Stack trace" description="1 in app, 5 framework">
					<Trace>
						<TraceStep title="CheckoutButton" description="checkout-button.tsx:14:25" status="error" defaultOpen>
							<CodeBlock code={FRAME} language="tsx" showLineNumbers startLine={FRAME_START_LINE} lineMarks={FRAME_MARKS} caption="checkout-button.tsx around line 14" />
						</TraceStep>
						{/* Framework frames fold into one row: they are real, but rarely where the fix is. */}
						<TraceStep title={`${String(FRAMEWORK_FRAMES.length)} frames in react-dom`}>
							<Trace>
								{FRAMEWORK_FRAMES.map((frame: string): React.JSX.Element => (
									<TraceLine key={frame} title={frame} />
								))}
							</Trace>
						</TraceStep>
					</Trace>
				</TraceStep>
			</Trace>
			<Dialog open={requestOpen} onOpenChange={setRequestOpen} showCloseButton>
				<DialogHeader>
					<DialogTitle>{REQUEST}</DialogTitle>
					<DialogDescription>{REQUEST_SUMMARY}</DialogDescription>
				</DialogHeader>
				<DialogBody>
					<CodeBlock code={RESPONSE} language="json" lineMarks={TEAM_PLAN_MARKS} caption="Response body" />
				</DialogBody>
			</Dialog>
		</>
	);
}
