import { Trace, TraceLine, TraceStep, type TraceLineStatus } from "@workspace/ui-native/components/trace";
import CloudUploadIcon from "lucide-react-native/icons/cloud-upload";
import GlobeIcon from "lucide-react-native/icons/globe";
import ImageIcon from "lucide-react-native/icons/image";
import VideoIcon from "lucide-react-native/icons/video";
import * as React from "react";
import { AccessibilityInfo } from "react-native";

interface Rendition {
	readonly label: string;
	/** Percentage points the demo encoder advances on each tick. */
	readonly speed: number;
	readonly size: string;
}

const RENDITIONS: readonly Rendition[] = [
	{ label: "2160p HEVC", speed: 4, size: "1.4 GB" },
	{ label: "1080p H.264", speed: 7, size: "612 MB" },
	{ label: "720p H.264", speed: 11, size: "318 MB" },
];

const RENDITION_COUNT = String(RENDITIONS.length);

/** A rendition is encoded at 100%. */
const COMPLETE_PERCENT = 100;
/** How often the demo encoder ticks, and how long each step after it takes. */
const ENCODE_TICK_MS = 160;
const AFTER_ENCODE_STEP_MS = 1_200;

type AfterEncodeStep = "thumbnails" | "publish";
type Stage = "encode" | AfterEncodeStep | "done";

/** The stages after encoding, in order; the index is how many of them have finished. */
const AFTER_ENCODE: readonly Stage[] = ["thumbnails", "publish", "done"];

type StepState = "pending" | "running" | "done";

const STEP_STATUS: Readonly<Record<StepState, TraceLineStatus | undefined>> = { pending: "pending", running: "running", done: undefined };

const STEP_LABELS: Readonly<Record<AfterEncodeStep, Readonly<Record<StepState, string>>>> = {
	thumbnails: { pending: "Generate thumbnails", running: "Generating 24 thumbnails", done: "Generated 24 thumbnails" },
	publish: { pending: "Publish to the CDN", running: "Publishing to the CDN", done: "Published to the CDN" },
};

const INITIAL_PROGRESS: readonly number[] = RENDITIONS.map((): number => 0);

function advance(current: readonly number[]): readonly number[] {
	return RENDITIONS.map((rendition: Rendition, index: number): number => Math.min(COMPLETE_PERCENT, (current.at(index) ?? 0) + rendition.speed));
}

function RenditionLine({ rendition, percent }: { readonly rendition: Rendition; readonly percent: number }): React.JSX.Element {
	const done = percent >= COMPLETE_PERCENT;
	const title = `${done ? "Encoded" : "Encoding"} ${rendition.label}`;
	// Percentages tick several times a second, so they are left out of the spoken name; the done line keeps its size.
	return (
		<TraceLine
			title={title}
			description={done ? rendition.size : `${String(percent)}%`}
			accessibilityLabel={done ? `${title}, ${rendition.size}` : title}
			status={done ? undefined : "running"}
		/>
	);
}

// Renditions encode in parallel under one row that stays open while any of them runs.
export function Trace22Example(): React.JSX.Element {
	const [progress, setProgress] = React.useState<readonly number[]>(INITIAL_PROGRESS);
	// Steps finished after encoding: 0 while thumbnails run, 2 when published.
	const [after, setAfter] = React.useState(0);
	const [encodeOpen, setEncodeOpen] = React.useState<boolean | undefined>(undefined);

	// The stage is derived, never stored, so it cannot lag behind the numbers.
	const finished = progress.filter((percent: number): boolean => percent >= COMPLETE_PERCENT).length;
	const encoding = finished < RENDITIONS.length;
	const stage: Stage = encoding ? "encode" : (AFTER_ENCODE.at(after) ?? "done");

	React.useEffect((): (() => void) | undefined => {
		if (stage === "done") {
			AccessibilityInfo.announceForAccessibility(`Video ready, ${RENDITION_COUNT} renditions published`);
			return undefined;
		}
		const timer = setTimeout(
			(): void => {
				if (encoding) {
					setProgress(advance);
					return;
				}
				setAfter((count: number): number => count + 1);
			},
			encoding ? ENCODE_TICK_MS : AFTER_ENCODE_STEP_MS,
		);
		return (): void => {
			clearTimeout(timer);
		};
	}, [stage, encoding, progress]);

	const stepState = (step: AfterEncodeStep): StepState => {
		const index = AFTER_ENCODE.indexOf(step);
		if (encoding || after < index) {
			return "pending";
		}
		return after === index ? "running" : "done";
	};
	const thumbnails = stepState("thumbnails");
	const publish = stepState("publish");

	return (
		<Trace accessibilityLabel="Media transcode">
			<TraceLine icon={CloudUploadIcon} title="Uploaded launch-keynote.mov" description="1.8 GB" />
			<TraceStep
				icon={VideoIcon}
				title={encoding ? `Encoding ${RENDITION_COUNT} renditions` : `Encoded ${RENDITION_COUNT} renditions`}
				description={`${String(finished)} of ${RENDITION_COUNT}`}
				status={encoding ? "running" : undefined}
				open={encodeOpen ?? encoding}
				onOpenChange={setEncodeOpen}>
				<Trace>
					{RENDITIONS.map((rendition: Rendition, index: number): React.JSX.Element => (
						<RenditionLine key={rendition.label} rendition={rendition} percent={progress.at(index) ?? 0} />
					))}
				</Trace>
			</TraceStep>
			<TraceLine icon={ImageIcon} title={STEP_LABELS.thumbnails[thumbnails]} status={STEP_STATUS[thumbnails]} />
			<TraceLine icon={GlobeIcon} title={STEP_LABELS.publish[publish]} status={STEP_STATUS[publish]} />
		</Trace>
	);
}
