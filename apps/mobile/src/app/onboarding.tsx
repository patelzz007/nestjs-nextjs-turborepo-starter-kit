// ============================================
// Onboarding (ADR 041) — the first-launch walkthrough
// ============================================
// Shown once per device, before sign-in: the root guard routes a signed-out
// device here until onboarding is finished or skipped, then on to sign-in.
// Finishing only records it in the preferences (Secure Store); the guard moves
// the app. Products rewrite the slides to tell their own story.

import BellIcon from "lucide-react-native/icons/bell";
import FingerprintPatternIcon from "lucide-react-native/icons/fingerprint-pattern";
import KeyRoundIcon from "lucide-react-native/icons/key-round";
import PaletteIcon from "lucide-react-native/icons/palette";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import SmartphoneIcon from "lucide-react-native/icons/smartphone";
import SunMoonIcon from "lucide-react-native/icons/sun-moon";
import UserIcon from "lucide-react-native/icons/user";
import * as React from "react";

import { OnboardingCarousel, type OnboardingLabels, type OnboardingSlide } from "../components/onboarding-carousel";
import { usePreferencesCommands } from "../features/preferences/facade";
import { useReadyRuntime } from "../runtime/runtime-context";

const LABELS: OnboardingLabels = {
	skip: "Skip",
	next: "Next",
	finish: "Get started",
	step: (current: number, total: number): string => `Step ${String(current)} of ${String(total)}`,
};

function slidesFor(appName: string): readonly OnboardingSlide[] {
	return [
		{
			key: "welcome",
			mark: { kind: "brand" },
			accents: [UserIcon, SmartphoneIcon],
			title: `Welcome to ${appName}`,
			description: "Your account, your devices and your settings, together in one place.",
		},
		{
			key: "security",
			mark: { kind: "icon", icon: ShieldCheckIcon },
			accents: [KeyRoundIcon, FingerprintPatternIcon],
			title: "Secure by design",
			description: "Two-factor sign-in, an app lock that opens with your face or fingerprint, and sign-out for any device you no longer use.",
		},
		{
			key: "yours",
			mark: { kind: "icon", icon: PaletteIcon },
			accents: [SunMoonIcon, BellIcon],
			title: "Made to feel like yours",
			description: "Light or dark, and preferences that stay on this device. You're ready to go.",
		},
	];
}

export default function OnboardingScreen(): React.JSX.Element {
	const { appName } = useReadyRuntime();
	const preferences = usePreferencesCommands();
	const slides = React.useMemo((): readonly OnboardingSlide[] => slidesFor(appName), [appName]);

	return <OnboardingCarousel brandName={appName} slides={slides} labels={LABELS} onFinish={preferences.onboardingCompleted} testID="onboarding" />;
}
