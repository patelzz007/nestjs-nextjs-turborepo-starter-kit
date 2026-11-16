"use client";

import { Button } from "@workspace/ui/components/button";
import { createToastManager, Toaster, type ToastPosition } from "@workspace/ui/components/toast";
import * as React from "react";

// The app's own <Toaster /> has one fixed placement, so this example mounts a
// second, isolated stack (its own manager) and moves it to the chosen corner.

const positionToasts = createToastManager();

interface PositionOption {
	readonly position: ToastPosition;
	readonly label: string;
}

const POSITION_OPTIONS: readonly PositionOption[] = [
	{ position: "top-left", label: "Top Left" },
	{ position: "top-center", label: "Top Center" },
	{ position: "top-right", label: "Top Right" },
	{ position: "bottom-left", label: "Bottom Left" },
	{ position: "bottom-center", label: "Bottom Center" },
	{ position: "bottom-right", label: "Bottom Right" },
];

interface PositionButtonProps {
	readonly option: PositionOption;
	readonly onSelect: (option: PositionOption) => void;
}

function PositionButton({ option, onSelect }: PositionButtonProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(option);
	}, [onSelect, option]);
	return (
		<Button size="sm" variant="outline" className="w-full" onClick={handleClick}>
			{option.label}
		</Button>
	);
}

export function Sonner3Example(): React.JSX.Element {
	const [position, setPosition] = React.useState<ToastPosition>("bottom-right");

	const showAt = React.useCallback((option: PositionOption): void => {
		setPosition(option.position);
		positionToasts.add({ title: option.label, description: `Notification appears in the ${option.label.toLowerCase()}.` });
	}, []);

	return (
		<div className="grid grid-cols-3 gap-2">
			{POSITION_OPTIONS.map((option: PositionOption): React.JSX.Element => (
				<PositionButton key={option.position} option={option} onSelect={showAt} />
			))}
			<Toaster toastManager={positionToasts} position={position} />
		</div>
	);
}
