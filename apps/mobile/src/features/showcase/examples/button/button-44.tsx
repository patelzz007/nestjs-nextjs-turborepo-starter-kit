import CheckIcon from "lucide-react-native/icons/check";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

type SavePhase = "idle" | "saving" | "saved";

/** How long the sample save takes, and how long Saved shows before the button resets, in ms. */
const SAVE_MS = 1200;
const RESET_MS = 2000;

export function Button44Example(): React.JSX.Element {
	const [phase, setPhase] = React.useState<SavePhase>("idle");
	React.useEffect((): (() => void) | undefined => {
		if (phase === "idle") {
			return undefined;
		}
		const timer = setTimeout(
			(): void => {
				setPhase(phase === "saving" ? "saved" : "idle");
			},
			phase === "saving" ? SAVE_MS : RESET_MS,
		);
		return (): void => {
			clearTimeout(timer);
		};
	}, [phase]);
	const save = React.useCallback((): void => {
		setPhase("saving");
	}, []);
	return (
		<Button
			label={phase === "saving" ? "Saving…" : phase === "saved" ? "Saved" : "Save changes"}
			icon={phase === "saved" ? CheckIcon : undefined}
			loading={phase === "saving"}
			onPress={save}
		/>
	);
}
