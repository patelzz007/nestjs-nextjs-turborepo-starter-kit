import * as React from "react";
import { GuidelineStepper } from "@/components/component-showcase/examples/stepper/stepper-guideline-sample";

const STEPS: readonly string[] = ["Details", "Payment", "Confirm"];

export function StepperDont2Example(): React.JSX.Element {
	return <GuidelineStepper titles={STEPS} initialStep={3} showTitles={false} marksDone={false} />;
}
