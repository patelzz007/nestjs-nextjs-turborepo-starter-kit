"use client";

import type * as React from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

const MIN_VOLUME = 0;
const MAX_VOLUME = 100;
const INITIAL_VOLUME = 50;
/** How much one press of − / + changes the volume, in percentage points. */
const VOLUME_STEP = 5;

export function ButtonGroup28Example(): React.JSX.Element {
	const [volume, setVolume] = useState<number>(INITIAL_VOLUME);
	const [isMuted, setIsMuted] = useState<boolean>(false);

	const increaseVolume = useCallback((): void => {
		setVolume((prev) => Math.min(prev + VOLUME_STEP, MAX_VOLUME));
		setIsMuted(false);
	}, []);

	const decreaseVolume = useCallback((): void => {
		const next = Math.max(volume - VOLUME_STEP, MIN_VOLUME);
		setVolume(next);
		if (next === MIN_VOLUME) {
			setIsMuted(true);
		}
	}, [volume]);

	const toggleMute = useCallback((): void => {
		setIsMuted((prev) => !prev);
	}, []);

	return (
		<ButtonGroup>
			<Button onClick={decreaseVolume} size="sm" variant="outline" aria-label="Decrease Volume">
				<MinusIcon aria-hidden="true" />
			</Button>
			<Button onClick={toggleMute} size="sm" variant="outline" className="min-w-20">
				{isMuted ? "Muted" : `${String(volume)}%`}
			</Button>
			<Button onClick={increaseVolume} size="sm" variant="outline" aria-label="Increase Volume">
				<PlusIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
