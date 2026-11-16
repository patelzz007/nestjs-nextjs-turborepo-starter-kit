import { Button } from "@workspace/ui-native/components/button";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Trace, TraceLine, TraceStep, type TraceLineStatus } from "@workspace/ui-native/components/trace";
import * as Clipboard from "expo-clipboard";
import CheckIcon from "lucide-react-native/icons/check";
import CopyIcon from "lucide-react-native/icons/copy";
import ListIcon from "lucide-react-native/icons/list";
import SearchIcon from "lucide-react-native/icons/search";
import SendIcon from "lucide-react-native/icons/send";
import * as React from "react";
import { AccessibilityInfo, Text, View } from "react-native";

const DOMAIN = "mail.northwind.dev";

interface DnsRecord {
	readonly id: string;
	readonly label: string;
	readonly type: string;
	readonly name: string;
	readonly value: string;
}

const RECORDS: readonly DnsRecord[] = [
	{ id: "spf", label: "SPF", type: "TXT", name: "mail", value: "v=spf1 include:_spf.mailer.dev ~all" },
	{ id: "dkim", label: "DKIM", type: "CNAME", name: "k1._domainkey.mail", value: "k1.dkim.mailer.dev" },
	{ id: "dmarc", label: "DMARC", type: "TXT", name: "_dmarc.mail", value: "v=DMARC1; p=none; rua=mailto:dmarc@northwind.dev" },
];

/** The records the first DNS check finds; DMARC is still missing. */
const FIRST_CHECK_FOUND: readonly string[] = ["spf", "dkim"];
const ALL_RECORD_IDS: readonly string[] = RECORDS.map((record: DnsRecord): string => record.id);
const RECORD_COUNT = String(RECORDS.length);

/** How long a demo DNS check takes, and how long a copy's check mark stays. */
const DNS_CHECK_DURATION_MS = 1_600;
const COPIED_RESET_MS = 1_500;

type Phase = "checking" | "partial" | "rechecking" | "ready";

/** The phase a running check settles into; idle phases have none. */
const NEXT_PHASE: Readonly<Partial<Record<Phase, Phase>>> = { checking: "partial", rechecking: "ready" };

function foundRecords(phase: Phase): readonly string[] {
	if (phase === "partial") {
		return FIRST_CHECK_FOUND;
	}
	return phase === "ready" ? ALL_RECORD_IDS : [];
}

function checkStatus(checking: boolean, phase: Phase): TraceLineStatus | undefined {
	if (checking) {
		return "running";
	}
	return phase === "partial" ? "error" : undefined;
}

function checkTitle(checking: boolean, verified: boolean): string {
	if (checking) {
		return "Checking DNS for the records";
	}
	return verified ? `Verified all ${RECORD_COUNT} records` : `Found ${String(FIRST_CHECK_FOUND.length)} of ${RECORD_COUNT} records, DMARC is missing`;
}

function phaseStatusText(checking: boolean, phase: Phase): string {
	if (checking) {
		return "Checking";
	}
	return phase === "partial" ? "DNS changes can take up to an hour" : "Domain verified";
}

function RecordCheckLine({ record, checking, ok }: { readonly record: DnsRecord; readonly checking: boolean; readonly ok: boolean }): React.JSX.Element {
	if (checking) {
		return <TraceLine title={`Look up ${record.label}`} status="pending" />;
	}
	return <TraceLine title={ok ? `${record.label} resolves` : `${record.label} not found on ${record.name}`} status={ok ? undefined : "error"} />;
}

/** One record: its type and name, its value in the code face, and a copy button. */
function RecordRow({ record, copied, onCopy }: { readonly record: DnsRecord; readonly copied: boolean; readonly onCopy: (record: DnsRecord) => void }): React.JSX.Element {
	const copy = React.useCallback((): void => {
		onCopy(record);
	}, [onCopy, record]);
	return (
		<View className="flex-row items-center gap-2 border-b border-border py-1.5">
			<View className="flex-1 gap-0.5">
				<Text className="text-caption font-sans-medium text-foreground">{`${record.type} · ${record.name}`}</Text>
				<Text numberOfLines={1} className="text-caption font-code text-muted-foreground">
					{record.value}
				</Text>
			</View>
			<IconButton icon={copied ? CheckIcon : CopyIcon} label={`Copy the ${record.label} value`} variant="ghost" size="xs" onPress={copy} />
		</View>
	);
}

// The records stay open beside the check that waits on them.
export function Trace21Example(): React.JSX.Element {
	const [phase, setPhase] = React.useState<Phase>("checking");
	const [copied, setCopied] = React.useState<string | null>(null);

	React.useEffect((): (() => void) | undefined => {
		const target = NEXT_PHASE[phase];
		if (target === undefined) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			setPhase(target);
		}, DNS_CHECK_DURATION_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [phase]);

	React.useEffect((): (() => void) | undefined => {
		if (copied === null) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			setCopied(null);
		}, COPIED_RESET_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [copied]);

	const copy = React.useCallback((record: DnsRecord): void => {
		Clipboard.setStringAsync(record.value)
			.then((): void => {
				setCopied(record.id);
				AccessibilityInfo.announceForAccessibility(`Copied the ${record.label} value`);
			})
			.catch((): void => {
				// The clipboard refused the copy: the value is still on screen to read.
			});
	}, []);
	const checkAgain = React.useCallback((): void => {
		setPhase("rechecking");
	}, []);

	const checking = phase === "checking" || phase === "rechecking";
	const verified = phase === "ready";
	const found = foundRecords(phase);

	return (
		<View className="gap-4">
			<Trace accessibilityLabel="Domain setup">
				<TraceStep icon={ListIcon} title={`Add ${RECORD_COUNT} records at your DNS provider`} defaultOpen>
					<View>
						{RECORDS.map((record: DnsRecord): React.JSX.Element => (
							<RecordRow key={record.id} record={record} copied={copied === record.id} onCopy={copy} />
						))}
					</View>
				</TraceStep>
				<TraceStep icon={SearchIcon} title={checkTitle(checking, verified)} status={checkStatus(checking, phase)} defaultOpen>
					<Trace>
						{RECORDS.map((record: DnsRecord): React.JSX.Element => (
							<RecordCheckLine key={record.id} record={record} checking={checking} ok={found.includes(record.id)} />
						))}
					</Trace>
				</TraceStep>
				<TraceLine icon={SendIcon} title={verified ? `Ready to send from ${DOMAIN}` : `Start sending from ${DOMAIN}`} status={verified ? undefined : "pending"} />
			</Trace>
			<View className="flex-row items-center gap-3">
				<Button label="Check DNS again" size="sm" variant="outline" disabled={phase !== "partial"} onPress={checkAgain} />
				<Text accessibilityLiveRegion="polite" className="text-caption shrink font-sans text-muted-foreground">
					{phaseStatusText(checking, phase)}
				</Text>
			</View>
		</View>
	);
}
