"use client";

// The Button examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { Button1Example } from "@/components/component-gallery/examples/button/button-1";
import { Button2Example } from "@/components/component-gallery/examples/button/button-2";
import { Button3Example } from "@/components/component-gallery/examples/button/button-3";
import { Button4Example } from "@/components/component-gallery/examples/button/button-4";
import { Button5Example } from "@/components/component-gallery/examples/button/button-5";
import { Button6Example } from "@/components/component-gallery/examples/button/button-6";
import { Button7Example } from "@/components/component-gallery/examples/button/button-7";
import { Button8Example } from "@/components/component-gallery/examples/button/button-8";
import { Button9Example } from "@/components/component-gallery/examples/button/button-9";
import { Button10Example } from "@/components/component-gallery/examples/button/button-10";
import { Button11Example } from "@/components/component-gallery/examples/button/button-11";
import { Button12Example } from "@/components/component-gallery/examples/button/button-12";
import { Button13Example } from "@/components/component-gallery/examples/button/button-13";
import { Button14Example } from "@/components/component-gallery/examples/button/button-14";
import { Button15Example } from "@/components/component-gallery/examples/button/button-15";
import { Button16Example } from "@/components/component-gallery/examples/button/button-16";
import { Button17Example } from "@/components/component-gallery/examples/button/button-17";
import { Button18Example } from "@/components/component-gallery/examples/button/button-18";
import { Button19Example } from "@/components/component-gallery/examples/button/button-19";
import { Button20Example } from "@/components/component-gallery/examples/button/button-20";
import { Button21Example } from "@/components/component-gallery/examples/button/button-21";
import { Button22Example } from "@/components/component-gallery/examples/button/button-22";
import { Button23Example } from "@/components/component-gallery/examples/button/button-23";
import { Button24Example } from "@/components/component-gallery/examples/button/button-24";
import { Button25Example } from "@/components/component-gallery/examples/button/button-25";
import { Button26Example } from "@/components/component-gallery/examples/button/button-26";
import { Button27Example } from "@/components/component-gallery/examples/button/button-27";
import { Button28Example } from "@/components/component-gallery/examples/button/button-28";
import { Button29Example } from "@/components/component-gallery/examples/button/button-29";
import { Button30Example } from "@/components/component-gallery/examples/button/button-30";
import { Button31Example } from "@/components/component-gallery/examples/button/button-31";
import { Button32Example } from "@/components/component-gallery/examples/button/button-32";
import { Button33Example } from "@/components/component-gallery/examples/button/button-33";
import { Button34Example } from "@/components/component-gallery/examples/button/button-34";
import { Button35Example } from "@/components/component-gallery/examples/button/button-35";
import { Button36Example } from "@/components/component-gallery/examples/button/button-36";
import { Button37Example } from "@/components/component-gallery/examples/button/button-37";
import { Button38Example } from "@/components/component-gallery/examples/button/button-38";
import { Button39Example } from "@/components/component-gallery/examples/button/button-39";
import { Button40Example } from "@/components/component-gallery/examples/button/button-40";
import { Button41Example } from "@/components/component-gallery/examples/button/button-41";
import { Button42Example } from "@/components/component-gallery/examples/button/button-42";
import { Button43Example } from "@/components/component-gallery/examples/button/button-43";
import { Button44Example } from "@/components/component-gallery/examples/button/button-44";
import { Button45Example } from "@/components/component-gallery/examples/button/button-45";
import { Button46Example } from "@/components/component-gallery/examples/button/button-46";
import { Button47Example } from "@/components/component-gallery/examples/button/button-47";
import { Button48Example } from "@/components/component-gallery/examples/button/button-48";
import { Button49Example } from "@/components/component-gallery/examples/button/button-49";
import { Button50Example } from "@/components/component-gallery/examples/button/button-50";
import { Button51Example } from "@/components/component-gallery/examples/button/button-51";
import { Button52Example } from "@/components/component-gallery/examples/button/button-52";
import { Button53Example } from "@/components/component-gallery/examples/button/button-53";
import { Button54Example } from "@/components/component-gallery/examples/button/button-54";
import { Button55Example } from "@/components/component-gallery/examples/button/button-55";
import { Button56Example } from "@/components/component-gallery/examples/button/button-56";
import { Button57Example } from "@/components/component-gallery/examples/button/button-57";
import { Button58Example } from "@/components/component-gallery/examples/button/button-58";
import { Button59Example } from "@/components/component-gallery/examples/button/button-59";
import { Button60Example } from "@/components/component-gallery/examples/button/button-60";
import { Button61Example } from "@/components/component-gallery/examples/button/button-61";

export const BUTTON_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-button-1", label: "Default", component: Button1Example },
	{ id: "c-button-2", label: "Secondary", component: Button2Example },
	{ id: "c-button-3", label: "Outline", component: Button3Example },
	{ id: "c-button-4", label: "Ghost", component: Button4Example },
	{ id: "c-button-5", label: "Destructive", component: Button5Example },
	{ id: "c-button-6", label: "Link", component: Button6Example },
	{ id: "c-button-7", label: "Extra Small", component: Button7Example },
	{ id: "c-button-8", label: "Small", component: Button8Example },
	{ id: "c-button-9", label: "Large", component: Button9Example },
	{ id: "c-button-10", label: "Disabled", component: Button10Example },
	{ id: "c-button-11", label: "Icon Button", component: Button11Example },
	{ id: "c-button-12", label: "Icon Right", component: Button12Example },
	{ id: "c-button-13", label: "Loading State", component: Button13Example },
	{ id: "c-button-14", label: "Icon Left", component: Button14Example },
	{ id: "c-button-15", label: "Invalid State", component: Button15Example },
	{ id: "c-button-16", label: "Secondary Icon Left", component: Button16Example },
	{ id: "c-button-17", label: "Secondary Icon Right", component: Button17Example },
	{ id: "c-button-18", label: "Outline Icon Left", component: Button18Example },
	{ id: "c-button-19", label: "Outline Icon Right", component: Button19Example },
	{ id: "c-button-20", label: "Ghost Icon Left", component: Button20Example },
	{ id: "c-button-21", label: "Ghost Icon Right", component: Button21Example },
	{ id: "c-button-22", label: "Destructive Icon Left", component: Button22Example },
	{ id: "c-button-23", label: "Destructive Icon Right", component: Button23Example },
	{ id: "c-button-24", label: "Extra Small Icon", component: Button24Example },
	{ id: "c-button-25", label: "Small Icon", component: Button25Example },
	{ id: "c-button-26", label: "Large Icon", component: Button26Example },
	{ id: "c-button-27", label: "Next Link", component: Button27Example },
	{ id: "c-button-28", label: "Link Icon Left", component: Button28Example },
	{ id: "c-button-29", label: "Link Icon Right", component: Button29Example },
	{ id: "c-button-30", label: "Large Icon Left", component: Button30Example },
	{ id: "c-button-31", label: "Large Icon Right", component: Button31Example },
	{ id: "c-button-32", label: "Outline Invalid", component: Button32Example },
	{ id: "c-button-33", label: "Ghost Invalid", component: Button33Example },
	{ id: "c-button-34", label: "Email Login", component: Button34Example },
	{ id: "c-button-35", label: "More Less Toggle", component: Button35Example },
	{ id: "c-button-36", label: "Outline Social Icons", component: Button36Example },
	{ id: "c-button-37", label: "Like Count", component: Button37Example },
	{ id: "c-button-38", label: "Star Count", component: Button38Example },
	{ id: "c-button-39", label: "Unread Badge", component: Button39Example },
	{ id: "c-button-40", label: "Shortcut Keys", component: Button40Example },
	{ id: "c-button-41", label: "Copy Feedback", component: Button41Example },
	{ id: "c-button-42", label: "Icon Copy", component: Button42Example },
	{ id: "c-button-43", label: "Hamburger Toggle", component: Button43Example },
	{ id: "c-button-44", label: "Async Action", component: Button44Example },
	{ id: "c-button-45", label: "Inline Count", component: Button45Example },
	{ id: "c-button-46", label: "Status Dot", component: Button46Example },
	{ id: "c-button-47", label: "Status Badge", component: Button47Example },
	{ id: "c-button-48", label: "Notification Badge", component: Button48Example },
	{ id: "c-button-49", label: "Go Back", component: Button49Example },
	{ id: "c-button-50", label: "Animated Go Back", component: Button50Example },
	{ id: "c-button-51", label: "Expanding Button", component: Button51Example },
	{ id: "c-button-52", label: "Title & Description", component: Button52Example },
	{ id: "c-button-53", label: "Sliding Arrow", component: Button53Example },
	{ id: "c-button-54", label: "Shortcut Tooltip", component: Button54Example },
	{ id: "c-button-55", label: "Avatar", component: Button55Example },
	{ id: "c-button-56", label: "Outline Avatar", component: Button56Example },
	{ id: "c-button-57", label: "Small Avatar", component: Button57Example },
	{ id: "c-button-58", label: "Small Outline Avatar", component: Button58Example },
	{ id: "c-button-59", label: "Social Login Stack", component: Button59Example },
	{ id: "c-button-60", label: "Colored Social Icons", component: Button60Example },
	{ id: "c-button-61", label: "Theme Toggle", component: Button61Example },
];

export function ButtonExamples(): React.JSX.Element {
	return <ExampleGrid examples={BUTTON_EXAMPLES} />;
}
