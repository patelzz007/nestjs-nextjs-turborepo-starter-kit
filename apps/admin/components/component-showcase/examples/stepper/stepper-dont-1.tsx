import * as React from "react";
import { GuidelineStepper } from "@/components/component-showcase/examples/stepper/stepper-guideline-sample";

const STEPS: readonly string[] = ["Account", "Profile", "Team", "Billing", "Plan", "Integrations", "Review", "Done"];

export function StepperDont1Example(): React.JSX.Element {
	return (
		<div className="w-72">
			<GuidelineStepper titles={STEPS} initialStep={4} showTitles marksDone />
		</div>
	);
}
