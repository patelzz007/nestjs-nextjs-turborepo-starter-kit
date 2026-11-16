"use client";

import type * as React from "react";

import { MissingShowcaseFeaturesError } from "@/components/component-showcase/showcase-errors";
import { SHOWCASE_FEATURE_SETS } from "@/components/component-showcase/generated/feature-sets";

export interface ShowcaseFeaturesProps {
	/** The component's slug (its file name in `components/ui`). */
	readonly slug: string;
}

/** One component's features: its own generated module, downloaded only for this page. */
export function ShowcaseFeatures({ slug }: ShowcaseFeaturesProps): React.JSX.Element {
	const renderFeatures = SHOWCASE_FEATURE_SETS.get(slug);
	if (renderFeatures === undefined) {
		throw new MissingShowcaseFeaturesError(slug);
	}
	return renderFeatures();
}
