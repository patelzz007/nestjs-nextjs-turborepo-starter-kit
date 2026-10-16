"use client";

// The Avatar examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Avatar1Example } from "@/components/component-gallery/examples/avatar/avatar-1";
import { Avatar2Example } from "@/components/component-gallery/examples/avatar/avatar-2";
import { Avatar3Example } from "@/components/component-gallery/examples/avatar/avatar-3";
import { Avatar4Example } from "@/components/component-gallery/examples/avatar/avatar-4";
import { Avatar5Example } from "@/components/component-gallery/examples/avatar/avatar-5";
import { Avatar6Example } from "@/components/component-gallery/examples/avatar/avatar-6";
import { Avatar7Example } from "@/components/component-gallery/examples/avatar/avatar-7";
import { Avatar8Example } from "@/components/component-gallery/examples/avatar/avatar-8";
import { Avatar9Example } from "@/components/component-gallery/examples/avatar/avatar-9";
import { Avatar10Example } from "@/components/component-gallery/examples/avatar/avatar-10";
import { Avatar11Example } from "@/components/component-gallery/examples/avatar/avatar-11";
import { Avatar12Example } from "@/components/component-gallery/examples/avatar/avatar-12";
import { Avatar13Example } from "@/components/component-gallery/examples/avatar/avatar-13";
import { Avatar14Example } from "@/components/component-gallery/examples/avatar/avatar-14";
import { Avatar15Example } from "@/components/component-gallery/examples/avatar/avatar-15";
import { Avatar16Example } from "@/components/component-gallery/examples/avatar/avatar-16";
import { Avatar17Example } from "@/components/component-gallery/examples/avatar/avatar-17";
import { Avatar18Example } from "@/components/component-gallery/examples/avatar/avatar-18";
import { Avatar19Example } from "@/components/component-gallery/examples/avatar/avatar-19";
import { Avatar20Example } from "@/components/component-gallery/examples/avatar/avatar-20";
import { Avatar21Example } from "@/components/component-gallery/examples/avatar/avatar-21";
import { Avatar22Example } from "@/components/component-gallery/examples/avatar/avatar-22";
import { Avatar23Example } from "@/components/component-gallery/examples/avatar/avatar-23";
import { Avatar24Example } from "@/components/component-gallery/examples/avatar/avatar-24";
import { Avatar25Example } from "@/components/component-gallery/examples/avatar/avatar-25";
import { Avatar26Example } from "@/components/component-gallery/examples/avatar/avatar-26";
import { Avatar27Example } from "@/components/component-gallery/examples/avatar/avatar-27";
import { Avatar28Example } from "@/components/component-gallery/examples/avatar/avatar-28";
import { Avatar29Example } from "@/components/component-gallery/examples/avatar/avatar-29";
import { Avatar30Example } from "@/components/component-gallery/examples/avatar/avatar-30";
import { Avatar31Example } from "@/components/component-gallery/examples/avatar/avatar-31";
import { Avatar32Example } from "@/components/component-gallery/examples/avatar/avatar-32";
import { Avatar33Example } from "@/components/component-gallery/examples/avatar/avatar-33";
import { Avatar34Example } from "@/components/component-gallery/examples/avatar/avatar-34";
import { Avatar35Example } from "@/components/component-gallery/examples/avatar/avatar-35";

export const AVATAR_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-avatar-1", label: "Basic", component: Avatar1Example },
	{ id: "c-avatar-2", label: "Fallbacks", component: Avatar2Example },
	{ id: "c-avatar-3", label: "Sizes", component: Avatar3Example },
	{ id: "c-avatar-4", label: "Border Radius", component: Avatar4Example },
	{ id: "c-avatar-5", label: "Custom Sizes", component: Avatar5Example },
	{ id: "c-avatar-6", label: "Status Dots", component: Avatar6Example },
	{ id: "c-avatar-7", label: "Badge Icons", component: Avatar7Example },
	{ id: "c-avatar-8", label: "Round Badge Corners", component: Avatar8Example },
	{ id: "c-avatar-9", label: "Square Badge Corners", component: Avatar9Example },
	{ id: "c-avatar-10", label: "Avatar Group", component: Avatar10Example },
	{ id: "c-avatar-11", label: "Group With Count", component: Avatar11Example },
	{ id: "c-avatar-12", label: "Plus Chip Group", component: Avatar12Example },
	{ id: "c-avatar-13", label: "Border Rings", component: Avatar13Example },
	{ id: "c-avatar-14", label: "Soft Fallbacks", component: Avatar14Example },
	{ id: "c-avatar-15", label: "Solid Fallbacks", component: Avatar15Example },
	{ id: "c-avatar-16", label: "User Details", component: Avatar16Example },
	{ id: "c-avatar-17", label: "Grayscale", component: Avatar17Example },
	{ id: "c-avatar-18", label: "Group Presence", component: Avatar18Example },
	{ id: "c-avatar-19", label: "Outline Button", component: Avatar19Example },
	{ id: "c-avatar-20", label: "Social Proof Pill", component: Avatar20Example },
	{ id: "c-avatar-21", label: "Compact Social Proof", component: Avatar21Example },
	{ id: "c-avatar-22", label: "Lift Tooltips", component: Avatar22Example },
	{ id: "c-avatar-23", label: "Hover Fan", component: Avatar23Example },
	{ id: "c-avatar-24", label: "Fan With Tooltips", component: Avatar24Example },
	{ id: "c-avatar-25", label: "Bordered Count Pill", component: Avatar25Example },
	{ id: "c-avatar-26", label: "Pill Outline Button", component: Avatar26Example },
	{ id: "c-avatar-27", label: "Pill Primary Button", component: Avatar27Example },
	{ id: "c-avatar-28", label: "Empty State", component: Avatar28Example },
	{ id: "c-avatar-29", label: "Group Add Button", component: Avatar29Example },
	{ id: "c-avatar-30", label: "Loading State", component: Avatar30Example },
	{ id: "c-avatar-31", label: "Custom Badge", component: Avatar31Example },
	{ id: "c-avatar-32", label: "Pulsing Ring", component: Avatar32Example },
	{ id: "c-avatar-33", label: "Gradient Ring", component: Avatar33Example },
	{ id: "c-avatar-34", label: "Multiple Badges", component: Avatar34Example },
	{ id: "c-avatar-35", label: "Dropdown Menu", component: Avatar35Example },
];

export function AvatarExamples(): React.JSX.Element {
	return <ExampleGrid examples={AVATAR_EXAMPLES} />;
}
