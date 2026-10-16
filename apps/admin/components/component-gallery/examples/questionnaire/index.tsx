"use client";

// The Questionnaire examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Questionnaire1Example } from "@/components/component-gallery/examples/questionnaire/questionnaire-1";
import { Questionnaire2Example } from "@/components/component-gallery/examples/questionnaire/questionnaire-2";
import { Questionnaire3Example } from "@/components/component-gallery/examples/questionnaire/questionnaire-3";
import { Questionnaire4Example } from "@/components/component-gallery/examples/questionnaire/questionnaire-4";
import { Questionnaire5Example } from "@/components/component-gallery/examples/questionnaire/questionnaire-5";
import { Questionnaire6Example } from "@/components/component-gallery/examples/questionnaire/questionnaire-6";
import { Questionnaire7Example } from "@/components/component-gallery/examples/questionnaire/questionnaire-7";

export const QUESTIONNAIRE_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-questionnaire-1", label: "Guided Setup", component: Questionnaire1Example },
	{ id: "c-questionnaire-2", label: "Multi-Select", component: Questionnaire2Example },
	{ id: "c-questionnaire-3", label: "Write-In Answer", component: Questionnaire3Example },
	{ id: "c-questionnaire-4", label: "Segmented Progress", component: Questionnaire4Example },
	{ id: "c-questionnaire-5", label: "Optional Skip", component: Questionnaire5Example },
	{ id: "c-questionnaire-6", label: "Cross-Question Rule", component: Questionnaire6Example },
	{ id: "c-questionnaire-7", label: "Conditional Branch", component: Questionnaire7Example },
];

export function QuestionnaireExamples(): React.JSX.Element {
	return <ExampleGrid examples={QUESTIONNAIRE_EXAMPLES} />;
}
