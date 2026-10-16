"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";

type Status = "idle" | "loading" | "success";

/** How long the simulated save takes, then how long "Saved" shows. */
const SAVE_DURATION_MS = 900;
const SUCCESS_DURATION_MS = 2000;

export function Button44Example(): React.JSX.Element {
	const [status, setStatus] = useState<Status>("idle");

	// Each timed state advances itself; the timer is cleared if the state changes or the button unmounts.
	useEffect((): (() => void) | undefined => {
		if (status === "idle") {
			return undefined;
		}
		const timer = setTimeout(
			(): void => {
				setStatus(status === "loading" ? "success" : "idle");
			},
			status === "loading" ? SAVE_DURATION_MS : SUCCESS_DURATION_MS,
		);
		return (): void => {
			clearTimeout(timer);
		};
	}, [status]);

	const handleClick = useCallback((): void => {
		setStatus((current: Status): Status => (current === "idle" ? "loading" : current));
	}, []);

	return (
		<Button onClick={handleClick} disabled={status === "loading"} aria-busy={status === "loading"} aria-live="polite" className="min-w-32">
			{status === "loading" ? (
				<>
					<Spinner aria-hidden="true" />
					Saving…
				</>
			) : status === "success" ? (
				<>
					<CheckIcon aria-hidden="true" />
					Saved
				</>
			) : (
				"Save changes"
			)}
		</Button>
	);
}
