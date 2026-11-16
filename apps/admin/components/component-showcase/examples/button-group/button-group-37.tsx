"use client";

import type * as React from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui/components/button-group";

const MIN_ZOOM = 10;
const MAX_ZOOM = 200;
const INITIAL_ZOOM = 100;
/** How much one press of − / + changes the zoom, in percentage points. */
const ZOOM_STEP = 10;

export function ButtonGroup37Example(): React.JSX.Element {
	const [zoom, setZoom] = useState<number>(INITIAL_ZOOM);

	const handleZoomIn = useCallback((): void => {
		setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
	}, []);

	const handleZoomOut = useCallback((): void => {
		setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
	}, []);

	return (
		<ButtonGroup>
			<Button variant="outline" size="icon" aria-label="Zoom out" onClick={handleZoomOut}>
				<MinusIcon aria-hidden="true" />
			</Button>
			<ButtonGroupText className="w-16 justify-center">{zoom}%</ButtonGroupText>
			<Button variant="outline" size="icon" aria-label="Zoom in" onClick={handleZoomIn}>
				<PlusIcon aria-hidden="true" />
			</Button>
		</ButtonGroup>
	);
}
