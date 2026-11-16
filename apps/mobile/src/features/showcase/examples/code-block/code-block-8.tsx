import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import { SegmentedControl } from "@workspace/ui-native/components/segmented-control";

import { snippet } from "./code-block-sample";

const CHECKOUT = snippet("checkout");
type Step = "price" | "charge" | "record";
const STEPS: readonly { readonly value: Step; readonly label: string }[] = [
	{ value: "price", label: "1 · Price" },
	{ value: "charge", label: "2 · Charge" },
	{ value: "record", label: "3 · Record" },
];
const FOCUS: Readonly<Record<Step, readonly number[]>> = { price: [2, 3, 4], charge: [5, 6, 7, 8, 9], record: [10, 11, 12, 13] };

// A three-step tour of a checkout function: the step chosen in the header keeps its lines in focus and dims the rest.
export function CodeBlock8Example(): React.JSX.Element {
	const [step, setStep] = React.useState<Step>("price");
	const header = <SegmentedControl label="Step" options={STEPS} value={step} onChange={setStep} size="sm" />;
	return <CodeBlock code={CHECKOUT.code} lines={CHECKOUT.lines} header={header} showLineNumbers focusLines={FOCUS[step]} />;
}
