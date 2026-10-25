import type { MeasuredNetworkQuality, NetworkQualityReading } from "@workspace/shared";
import SignalIcon from "lucide-react-native/icons/signal";
import SignalHighIcon from "lucide-react-native/icons/signal-high";
import SignalLowIcon from "lucide-react-native/icons/signal-low";
import SignalMediumIcon from "lucide-react-native/icons/signal-medium";
import SignalZeroIcon from "lucide-react-native/icons/signal-zero";
import WifiOffIcon from "lucide-react-native/icons/wifi-off";

import { networkPillContent, networkSheetContent } from "../network-indicators";

const MEASURED_AT_MS = 1_791_504_000_000;

function measured(quality: Omit<MeasuredNetworkQuality, "kind">): NetworkQualityReading {
	return { status: "measured", quality: { kind: "measured", ...quality }, measuredAtMs: MEASURED_AT_MS };
}

const STRONG = measured({ pingMs: 42, jitterMs: 3, lossPercent: 0, strength: "strong" });
const MODERATE = measured({ pingMs: 180, jitterMs: 12, lossPercent: 0, strength: "moderate" });
const WEAK = measured({ pingMs: 640, jitterMs: 90, lossPercent: 25, strength: "weak" });

function fixedTime(epochMs: number): string {
	return epochMs === MEASURED_AT_MS ? "14:02:31" : "unexpected";
}

describe("networkPillContent", () => {
	it("is green, yellow or red by strength, with the ping — alone when compact, after the strength in full", () => {
		expect(networkPillContent(STRONG, true)).toMatchObject({ icon: SignalIcon, label: "42 ms", tone: "success", tabularLabel: true });
		expect(networkPillContent(STRONG, false)).toMatchObject({ label: "Strong, 42 ms", accessibilityLabel: "Connection: strong, 42 ms ping" });
		expect(networkPillContent(MODERATE, true)).toMatchObject({ icon: SignalMediumIcon, label: "180 ms", tone: "warning" });
		expect(networkPillContent(WEAK, false)).toMatchObject({ icon: SignalLowIcon, label: "Weak, 640 ms", tone: "destructive" });
	});

	it("breathes, neutral, while the first test runs", () => {
		expect(networkPillContent({ status: "measuring" }, true)).toMatchObject({ icon: SignalHighIcon, label: null, tone: "neutral", pulsing: true });
		expect(networkPillContent({ status: "measuring" }, false)).toMatchObject({ label: "Measuring…", accessibilityLabel: "Connection: measuring" });
	});

	it("is red offline, and red when the server does not answer", () => {
		expect(networkPillContent({ status: "offline" }, true)).toMatchObject({ icon: WifiOffIcon, label: null, accessibilityLabel: "Offline", tone: "destructive" });
		expect(networkPillContent({ status: "offline" }, false)).toMatchObject({ label: "Offline" });
		const unreachable: NetworkQualityReading = { status: "unreachable", measuredAtMs: MEASURED_AT_MS };
		expect(networkPillContent(unreachable, false)).toMatchObject({ icon: SignalZeroIcon, label: "No response", tone: "destructive" });
	});
});

describe("networkSheetContent", () => {
	it("reads out the ping, jitter and packet loss of a measured connection, and when it was tested", () => {
		expect(networkSheetContent(WEAK, fixedTime)).toEqual({
			icon: SignalLowIcon,
			tone: "red",
			headline: "Weak connection",
			description: "Expect delays. Some actions may time out.",
			metrics: [
				{ label: "Ping", value: "640", unit: "ms" },
				{ label: "Jitter", value: "90", unit: "ms" },
				{ label: "Packet loss", value: "25", unit: "%" },
			],
			lastTest: "Tested at 14:02:31",
			canTest: true,
		});
		expect(networkSheetContent(STRONG, fixedTime)).toMatchObject({ tone: "green", headline: "Strong connection" });
		expect(networkSheetContent(MODERATE, fixedTime)).toMatchObject({ tone: "yellow", headline: "Moderate connection" });
	});

	it("has no figures to show while measuring, offline or unanswered, and cannot test offline", () => {
		expect(networkSheetContent({ status: "measuring" }, fixedTime)).toMatchObject({ metrics: null, lastTest: null, canTest: true });
		expect(networkSheetContent({ status: "offline" }, fixedTime)).toMatchObject({ headline: "You're offline", metrics: null, canTest: false });
		expect(networkSheetContent({ status: "unreachable", measuredAtMs: MEASURED_AT_MS }, fixedTime)).toMatchObject({
			headline: "The server isn't answering",
			metrics: null,
			lastTest: "Tested at 14:02:31",
			canTest: true,
		});
	});
});
