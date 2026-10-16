"use client";

// The InputOtp examples on the /components page, ported from the reui registry (see examples/gallery-example.ts).

import type * as React from "react";

import { ExampleGrid } from "@/components/component-gallery/examples/example-grid";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { InputOtp1Example } from "@/components/component-gallery/examples/input-otp/input-otp-1";
import { InputOtp2Example } from "@/components/component-gallery/examples/input-otp/input-otp-2";
import { InputOtp3Example } from "@/components/component-gallery/examples/input-otp/input-otp-3";
import { InputOtp4Example } from "@/components/component-gallery/examples/input-otp/input-otp-4";
import { InputOtp5Example } from "@/components/component-gallery/examples/input-otp/input-otp-5";
import { InputOtp6Example } from "@/components/component-gallery/examples/input-otp/input-otp-6";

export const INPUT_OTP_EXAMPLES: readonly GalleryExample[] = [
	{ id: "c-input-otp-1", label: "Basic", component: InputOtp1Example },
	{ id: "c-input-otp-2", label: "Digits Only", component: InputOtp2Example },
	{ id: "c-input-otp-3", label: "Multiple Separators", component: InputOtp3Example },
	{ id: "c-input-otp-4", label: "Letters & Numbers", component: InputOtp4Example },
	{ id: "c-input-otp-5", label: "PIN Code", component: InputOtp5Example },
	{ id: "c-input-otp-6", label: "Verification Card", component: InputOtp6Example },
];

export function InputOtpExamples(): React.JSX.Element {
	return <ExampleGrid examples={INPUT_OTP_EXAMPLES} />;
}
