// GitHub's diffstat: five small squares showing how a change splits between
// added (green) and deleted (red) lines, the rest grey. Decorative — the
// counts next to it carry the meaning for screen readers. Presentational: the
// caller decides how many squares are which (features/github/diff.ts).

import * as React from "react";
import { View } from "react-native";

export interface DiffStatBlocks {
	readonly added: number;
	readonly deleted: number;
	readonly unchanged: number;
}

export interface DiffStatProps {
	readonly blocks: DiffStatBlocks;
	readonly testID?: string;
}

type BlockKind = keyof DiffStatBlocks;

const BLOCK_CLASSES: Readonly<Record<BlockKind, string>> = {
	added: "bg-success",
	deleted: "bg-destructive",
	unchanged: "bg-muted border border-border",
};

const BLOCK_ORDER: readonly BlockKind[] = ["added", "deleted", "unchanged"];

interface Square {
	readonly key: string;
	readonly kind: BlockKind;
}

export function DiffStat({ blocks, testID }: DiffStatProps): React.JSX.Element {
	const squares = BLOCK_ORDER.flatMap((kind: BlockKind): Square[] =>
		Array.from({ length: blocks[kind] }, (_entry: undefined, position: number): Square => ({ key: `${kind}-${String(position)}`, kind })),
	);
	return (
		<View className="flex-row gap-0.5" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID={testID}>
			{squares.map((square: Square): React.JSX.Element => (
				<View key={square.key} className={`size-2 rounded-[2px] ${BLOCK_CLASSES[square.kind]}`} testID={testID === undefined ? undefined : `${testID}-${square.kind}`} />
			))}
		</View>
	);
}
