import * as React from "react";
import { GuidelineStepper } from "@/components/component-showcase/examples/stepper/stepper-guideline-sample";

const STEPS: readonly string[] = ["Details", "Payment", "Confirm"];

export function StepperDo1Example(): React.JSX.Element {
	return <GuidelineStepper titles={STEPS} initialStep={2} showTitles marksDone />;
}
