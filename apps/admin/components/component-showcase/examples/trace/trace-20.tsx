"use client";

import { BadgeCheckIcon, MapPinIcon, ShieldCheckIcon, UserCheckIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@workspace/ui/components/trace";

/** How long the demo sanctions screening runs before it finishes. */
const SCREENING_DURATION_MS = 2400;

function statusText(screened: boolean, requested: boolean): string {
	if (requested) {
		return "New proof of address requested";
	}
	return screened ? "Screening finished, no matches" : "";
}

// Asking for a new document turns the failure into a pending step, since the
// case stays open until the applicant replies.
export function Trace20Example(): React.JSX.Element {
	const [screened, setScreened] = React.useState(false);
	const [requested, setRequested] = React.useState(false);
	const addressTrigger = React.useRef<HTMLButtonElement>(null);

	React.useEffect((): (() => void) => {
		const timer = window.setTimeout((): void => {
			setScreened(true);
		}, SCREENING_DURATION_MS);
		return (): void => {
			window.clearTimeout(timer);
		};
	}, []);

	const requestDocument = React.useCallback((): void => {
		setRequested(true);
		// The button sits in the panel it replaces, so focus goes back to the row.
		addressTrigger.current?.focus();
	}, []);

	return (
		<div className="flex w-full max-w-md flex-col gap-4 text-sm">
			<Trace>
				<TraceLine>
					<TraceIcon>
						<BadgeCheckIcon />
					</TraceIcon>
					<TraceTitle>Verified the passport</TraceTitle>
					<TraceDescription>chip and MRZ match</TraceDescription>
				</TraceLine>
				<TraceLine>
					<TraceIcon>
						<UserCheckIcon />
					</TraceIcon>
					<TraceTitle>Matched the selfie to the photo</TraceTitle>
					<TraceDescription>97% similar</TraceDescription>
				</TraceLine>
				<TraceLine status={screened ? undefined : "running"}>
					<TraceIcon>
						<ShieldCheckIcon />
					</TraceIcon>
					<TraceTitle>{screened ? "Screened sanctions and PEP lists" : "Screening sanctions and PEP lists"}</TraceTitle>
					{screened ? <TraceDescription>no matches</TraceDescription> : null}
				</TraceLine>
				<TraceCollapsible defaultOpen>
					<TraceCollapsibleTrigger ref={addressTrigger}>
						<TraceLine status={requested ? "pending" : "error"}>
							<TraceIcon>
								<MapPinIcon />
							</TraceIcon>
							<TraceTitle>{requested ? "Waiting for a new proof of address" : "Rejected the proof of address"}</TraceTitle>
							<TraceDescription>{requested ? "requested just now" : "too old"}</TraceDescription>
						</TraceLine>
					</TraceCollapsibleTrigger>
					<TraceCollapsibleContent>
						<div className="flex flex-col items-start gap-3">
							{requested ? (
								<p className="text-pretty">Jordan was emailed a link to upload a recent one.</p>
							) : (
								<>
									<p className="text-pretty">The utility bill is from June 2, and policy needs one from the last 90 days.</p>
									<Button size="xs" variant="outline" onClick={requestDocument}>
										Request a new document
									</Button>
								</>
							)}
						</div>
					</TraceCollapsibleContent>
				</TraceCollapsible>
			</Trace>
			{/* Rows change in place, so the two changes a reviewer waits for are
            also announced. */}
			<p role="status" className="sr-only">
				{statusText(screened, requested)}
			</p>
		</div>
	);
}
