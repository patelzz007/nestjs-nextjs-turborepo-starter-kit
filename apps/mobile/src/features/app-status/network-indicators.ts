// ============================================
// network-indicators.ts - what the connection pill and sheet say
// ============================================
// Pure: how a connection reading (packages/shared lib/network-quality) reads
// in the status pill — compact in the screens' top-right corner, full in the
// app drawer — and in the speedtest-style sheet the pill opens. Green strong,
// yellow moderate, red weak; the bars, the words and the sheet's headline say
// the same, so colour is never the only signal. The same states and copy as
// the web shells' NetworkQualityIndicator (@workspace/ui).

import type { MeasuredNetworkQuality, NetworkQualityReading, NetworkStrength } from "@workspace/shared";
import SignalIcon from "lucide-react-native/icons/signal";
import SignalHighIcon from "lucide-react-native/icons/signal-high";
import SignalLowIcon from "lucide-react-native/icons/signal-low";
import SignalMediumIcon from "lucide-react-native/icons/signal-medium";
import SignalZeroIcon from "lucide-react-native/icons/signal-zero";
import WifiOffIcon from "lucide-react-native/icons/wifi-off";

import type { LucideIcon } from "@workspace/ui-native/components/icon";
import type { IconTileTone } from "@workspace/ui-native/components/icon-tile";
import type { StatusBadgeTone } from "@workspace/ui-native/components/status-badge";
import { QUIET_PILL, type StatusPillContent } from "./indicators";

const STRENGTH_WORDS: Readonly<Record<NetworkStrength, string>> = { strong: "Strong", moderate: "Moderate", weak: "Weak" };

interface StrengthFace {
	readonly icon: LucideIcon;
	readonly tone: StatusBadgeTone;
	readonly tileTone: IconTileTone;
}

const STRENGTH_FACES: Readonly<Record<NetworkStrength, StrengthFace>> = {
	strong: { icon: SignalIcon, tone: "success", tileTone: "green" },
	moderate: { icon: SignalMediumIcon, tone: "warning", tileTone: "yellow" },
	weak: { icon: SignalLowIcon, tone: "destructive", tileTone: "red" },
};

function pingText(pingMs: number): string {
	return `${String(pingMs)} ms`;
}

export function networkPillContent(reading: NetworkQualityReading, compact: boolean): StatusPillContent {
	switch (reading.status) {
		case "measuring":
			return {
				...QUIET_PILL,
				icon: SignalHighIcon,
				label: compact ? null : "Measuring…",
				accessibilityLabel: "Connection: measuring",
				tone: "neutral",
				pulsing: true,
			};
		case "offline":
			return { ...QUIET_PILL, icon: WifiOffIcon, label: compact ? null : "Offline", accessibilityLabel: "Offline", tone: "destructive" };
		case "unreachable":
			return {
				...QUIET_PILL,
				icon: SignalZeroIcon,
				label: compact ? null : "No response",
				accessibilityLabel: "Connection: no response from the server",
				tone: "destructive",
			};
		case "measured": {
			const { strength, pingMs } = reading.quality;
			const face = STRENGTH_FACES[strength];
			return {
				...QUIET_PILL,
				icon: face.icon,
				label: compact ? pingText(pingMs) : `${STRENGTH_WORDS[strength]}, ${pingText(pingMs)}`,
				accessibilityLabel: `Connection: ${STRENGTH_WORDS[strength].toLowerCase()}, ${pingText(pingMs)} ping`,
				tone: face.tone,
				tabularLabel: true,
			};
		}
	}
}

/** One figure of the sheet: "Ping 42 ms". */
export interface NetworkMetric {
	readonly label: string;
	readonly value: string;
	readonly unit: string;
}

/** What the connection sheet shows. */
export interface NetworkSheetContent {
	readonly icon: LucideIcon;
	readonly tone: IconTileTone;
	readonly headline: string;
	readonly description: string;
	/** Ping, jitter and packet loss — only when the last test was answered. */
	readonly metrics: readonly NetworkMetric[] | null;
	/** "Tested at 14:02:31", or `null` before the first test. */
	readonly lastTest: string | null;
	/** "Test again" works: the device is online. */
	readonly canTest: boolean;
}

const STRENGTH_COPY: Readonly<Record<NetworkStrength, { readonly headline: string; readonly description: string }>> = {
	strong: { headline: "Strong connection", description: "Pages and actions should feel instant." },
	moderate: { headline: "Moderate connection", description: "Most things work, but actions may take a moment." },
	weak: { headline: "Weak connection", description: "Expect delays. Some actions may time out." },
};

function metricsOf(quality: MeasuredNetworkQuality): readonly NetworkMetric[] {
	return [
		{ label: "Ping", value: String(quality.pingMs), unit: "ms" },
		{ label: "Jitter", value: String(quality.jitterMs), unit: "ms" },
		{ label: "Packet loss", value: String(quality.lossPercent), unit: "%" },
	];
}

/** `formatTime` turns the test's epoch ms into a time of day (the device's locale in the app, fixed in tests). */
export function networkSheetContent(reading: NetworkQualityReading, formatTime: (epochMs: number) => string): NetworkSheetContent {
	switch (reading.status) {
		case "measuring":
			return {
				icon: SignalHighIcon,
				tone: "neutral",
				headline: "Measuring your connection",
				description: "Timing a few small requests to the server.",
				metrics: null,
				lastTest: null,
				canTest: true,
			};
		case "offline":
			return {
				icon: WifiOffIcon,
				tone: "red",
				headline: "You're offline",
				description: "Your device has no network. The test runs again when it's back.",
				metrics: null,
				lastTest: null,
				canTest: false,
			};
		case "unreachable":
			return {
				icon: SignalZeroIcon,
				tone: "red",
				headline: "The server isn't answering",
				description: "Your device is online, but no request reached the server.",
				metrics: null,
				lastTest: `Tested at ${formatTime(reading.measuredAtMs)}`,
				canTest: true,
			};
		case "measured": {
			const { strength } = reading.quality;
			return {
				icon: STRENGTH_FACES[strength].icon,
				tone: STRENGTH_FACES[strength].tileTone,
				...STRENGTH_COPY[strength],
				metrics: metricsOf(reading.quality),
				lastTest: `Tested at ${formatTime(reading.measuredAtMs)}`,
				canTest: true,
			};
		}
	}
}
