"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";

export function Button35Example(): React.JSX.Element {
	const [isExpanded, setIsExpanded] = useState(false);
	const toggleExpanded = useCallback((): void => {
		setIsExpanded((current: boolean): boolean => !current);
	}, []);

	return (
		<Button variant="ghost" onClick={toggleExpanded}>
			{isExpanded ? "Show less" : "Show more"}
			{isExpanded ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
		</Button>
	);
}
