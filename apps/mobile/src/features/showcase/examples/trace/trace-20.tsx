import { Button } from "@workspace/ui-native/components/button";
import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
import BadgeCheckIcon from "lucide-react-native/icons/badge-check";
import MapPinIcon from "lucide-react-native/icons/map-pin";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import UserCheckIcon from "lucide-react-native/icons/user-check";
import * as React from "react";
import { AccessibilityInfo, Text } from "react-native";

/** How long the demo sanctions screening runs before it finishes. */
const SCREENING_DURATION_MS = 2_400;

// Asking for a new document turns the failure into a pending step: the case stays open until the applicant replies.
export function Trace20Example(): React.JSX.Element {
	const [screened, setScreened] = React.useState(false);
	const [requested, setRequested] = React.useState(false);

	React.useEffect((): (() => void) => {
		const timer = setTimeout((): void => {
			setScreened(true);
			// Rows change in place, so the two changes a reviewer waits for are also announced.
			AccessibilityInfo.announceForAccessibility("Screening finished, no matches");
		}, SCREENING_DURATION_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, []);

	const requestDocument = React.useCallback((): void => {
		setRequested(true);
		AccessibilityInfo.announceForAccessibility("New proof of address requested");
	}, []);

	return (
		<Trace accessibilityLabel="Identity review">
			<TraceLine icon={BadgeCheckIcon} title="Verified the passport" description="chip and MRZ match" />
			<TraceLine icon={UserCheckIcon} title="Matched the selfie to the photo" description="97% similar" />
			<TraceLine
				icon={ShieldCheckIcon}
				title={screened ? "Screened sanctions and PEP lists" : "Screening sanctions and PEP lists"}
				description={screened ? "no matches" : undefined}
				status={screened ? undefined : "running"}
			/>
			<TraceStep
				icon={MapPinIcon}
				title={requested ? "Waiting for a new proof of address" : "Rejected the proof of address"}
				description={requested ? "requested just now" : "too old"}
				status={requested ? "pending" : "error"}
				detailClassName="items-start"
				defaultOpen>
				{requested ? (
					<Text className="text-label font-sans text-muted-foreground">Jordan was emailed a link to upload a recent one.</Text>
				) : (
					<>
						<Text className="text-label font-sans text-muted-foreground">The utility bill is from June 2, and policy needs one from the last 90 days.</Text>
						<Button label="Request a new document" size="xs" variant="outline" onPress={requestDocument} />
					</>
				)}
			</TraceStep>
		</Trace>
	);
}
