"use client";

// The NativeSelect examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { NativeSelect1Example } from "@/components/component-gallery/examples/native-select/native-select-1";
import { NativeSelect2Example } from "@/components/component-gallery/examples/native-select/native-select-2";
import { NativeSelect3Example } from "@/components/component-gallery/examples/native-select/native-select-3";
import { NativeSelect4Example } from "@/components/component-gallery/examples/native-select/native-select-4";
import { NativeSelect5Example } from "@/components/component-gallery/examples/native-select/native-select-5";
import { NativeSelect6Example } from "@/components/component-gallery/examples/native-select/native-select-6";

export const NATIVE_SELECT_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-native-select-1", label: "Basic", component: NativeSelect1Example },
	{ id: "c-native-select-2", label: "Grouped Options", component: NativeSelect2Example },
	{ id: "c-native-select-3", label: "Small", component: NativeSelect3Example },
	{ id: "c-native-select-4", label: "Field With Label", component: NativeSelect4Example },
	{ id: "c-native-select-5", label: "Disabled", component: NativeSelect5Example },
	{ id: "c-native-select-6", label: "Invalid", component: NativeSelect6Example },
];

export function NativeSelectExamples(): React.JSX.Element {
	return <ExampleGrid examples={NATIVE_SELECT_EXAMPLES} />;
}
