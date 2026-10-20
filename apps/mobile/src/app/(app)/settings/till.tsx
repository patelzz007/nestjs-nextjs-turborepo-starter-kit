// ============================================
// Till — scan and redeem customers' rewards (features/till)
// ============================================
// Unpaired: pair this phone as a POS terminal with the code (or QR code) the
// merchant console shows. Paired: the counter — scan the customer's reward QR,
// check it, enter the bill and redeem it — plus who the till belongs to and a
// way to unpair it. Every till call carries the terminal's API key, never the
// signed-in person's session (@workspace/api-client `posRouter`).

import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import { DetailList, type DetailItem } from "@workspace/ui-native/components/detail-list";
import { ErrorState, LoadingState } from "@workspace/ui-native/components/empty";
import * as React from "react";

import { Screen } from "../../../components/screen";
import { useToast } from "../../../features/toast/facade";
import { type PairedTerminal, TILL_COPY, TillCounter, TillPairing, usePairedTerminal } from "../../../contexts/pos";

export default function TillScreen(): React.JSX.Element {
	const { state, reload, pair, unpair } = usePairedTerminal();
	const toast = useToast();
	const [isUnpairOpen, setUnpairOpen] = React.useState(false);

	const handlePaired = React.useCallback(
		async (terminal: PairedTerminal): Promise<void> => {
			await pair(terminal);
			toast.success(TILL_COPY.paired(terminal.terminalName));
		},
		[pair, toast],
	);
	const askUnpair = React.useCallback((): void => {
		setUnpairOpen(true);
	}, []);
	const cancelUnpair = React.useCallback((): void => {
		setUnpairOpen(false);
	}, []);
	const confirmUnpair = React.useCallback((): void => {
		void unpair().then((): void => {
			setUnpairOpen(false);
			toast.success(TILL_COPY.unpaired);
		});
	}, [toast, unpair]);

	return (
		<Screen description={TILL_COPY.description}>
			{state.status === "loading" ? <LoadingState label={TILL_COPY.loading} /> : null}
			{state.status === "unreadable" ? <ErrorState message={TILL_COPY.loadError} retryLabel={TILL_COPY.retry} onRetry={reload} /> : null}
			{state.status === "unpaired" ? <TillPairing onPaired={handlePaired} /> : null}
			{state.status === "paired" ? (
				<>
					<TillCounter terminal={state.terminal} />
					<Card title={TILL_COPY.terminalTitle}>
						<DetailList items={terminalDetails(state.terminal)} />
						<Button label={TILL_COPY.unpair} variant="secondary" onPress={askUnpair} />
					</Card>
				</>
			) : null}
			<AlertDialog
				visible={isUnpairOpen}
				title={TILL_COPY.unpairTitle}
				description={TILL_COPY.unpairDescription}
				confirmLabel={TILL_COPY.unpairConfirm}
				cancelLabel={TILL_COPY.cancel}
				onConfirm={confirmUnpair}
				onCancel={cancelUnpair}
				destructive
			/>
		</Screen>
	);
}

function terminalDetails(terminal: PairedTerminal): DetailItem[] {
	return [
		{ label: TILL_COPY.terminalLabel, value: terminal.terminalName },
		{ label: TILL_COPY.storeLabel, value: terminal.locationName },
		{ label: TILL_COPY.businessLabel, value: terminal.organizationName },
	];
}
