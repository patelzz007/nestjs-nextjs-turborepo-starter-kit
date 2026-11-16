"use client";

import * as React from "react";
import { Volume2Icon, VolumeOffIcon } from "lucide-react";
import { useState } from "react";

import { Toggle } from "@workspace/ui/components/toggle";

export function Toggle14Example(): React.JSX.Element {
	const [muted, setMuted] = useState(false);

	return (
		<div className="flex items-center justify-center">
			<Toggle size="lg" variant="outline" aria-label="Toggle mute" pressed={muted} onPressedChange={setMuted}>
				{muted ? <VolumeOffIcon /> : <Volume2Icon />}
				{muted ? "Muted" : "Sound"}
			</Toggle>
		</div>
	);
}
