"use client";

import { useAnimate, useReducedMotion, type DOMKeyframesDefinition } from "framer-motion";
import { RefreshCw, Send, Trash2, type LucideIcon } from "lucide-react";
import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { DataTable, type DataTableColumns, type DataTableRowAction } from "@workspace/ui/components/data-table";

// ── Animated icons ─────────────────────────────────────────────────────────

/** One icon's hover motion: the keyframes it plays, and for how long. */
interface IconMotion {
	readonly keyframes: DOMKeyframesDefinition;
	readonly durationSeconds: number;
}

/** Sync turns half a turn, Send flies up and right and comes back, Delete shakes. */
export const ICON_MOTIONS: Readonly<Record<"sync" | "send" | "delete", IconMotion>> = {
	sync: { keyframes: { rotate: [0, 180] }, durationSeconds: 0.5 },
	send: { keyframes: { x: [0, 3, 0], y: [0, -3, 0] }, durationSeconds: 0.4 },
	delete: { keyframes: { rotate: [0, -12, 10, -6, 0] }, durationSeconds: 0.45 },
};

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface AnimatedIconProps {
	readonly icon: LucideIcon;
	readonly motion: IconMotion;
}

/**
 * An icon that plays its motion when the control holding it is hovered or focused, so the whole button (not only the
 * glyph) is the target. It stands still when the reader asks for reduced motion.
 */
function AnimatedIcon({ icon: Icon, motion }: AnimatedIconProps): React.JSX.Element {
	const [scope, animate] = useAnimate<HTMLSpanElement>();
	const prefersReducedMotion = useReducedMotion() === true;

	React.useEffect((): (() => void) | undefined => {
		const control = scope.current.closest("button, [role='menuitem']");
		if (control === null || prefersReducedMotion) {
			return undefined;
		}
		const play = (): void => {
			void animate(scope.current, motion.keyframes, { duration: motion.durationSeconds, ease: EASE_OUT });
		};
		control.addEventListener("pointerenter", play);
		control.addEventListener("focus", play);
		return (): void => {
			control.removeEventListener("pointerenter", play);
			control.removeEventListener("focus", play);
		};
	}, [animate, motion, prefersReducedMotion, scope]);

	return (
		<span ref={scope} className="inline-flex" aria-hidden="true">
			<Icon className="size-4" />
		</span>
	);
}

// ── Data ───────────────────────────────────────────────────────────────────

/** One connected integration. */
interface Integration {
	readonly id: string;
	readonly name: string;
	readonly events: number;
	readonly lastSync: string;
}

export const INTEGRATIONS: readonly Integration[] = [
	{ id: "chat", name: "Team chat", events: 1284, lastSync: "2 minutes ago" },
	{ id: "repo", name: "Code host", events: 342, lastSync: "1 hour ago" },
	{ id: "billing", name: "Billing provider", events: 97, lastSync: "Yesterday" },
	{ id: "crm", name: "CRM", events: 2210, lastSync: "5 minutes ago" },
];

/** How long a pretend sync takes. */
export const SYNC_DURATION_MS = 1200;

/**
 * A pretend sync. The billing provider fails its first attempt, so the retry state can be seen; every other sync,
 * and the billing provider's retry, succeeds.
 */
export function createSync(): (integration: Integration) => Promise<void> {
	const attempts = new Map<string, number>();
	return (integration: Integration): Promise<void> => {
		const attempt = (attempts.get(integration.id) ?? 0) + 1;
		attempts.set(integration.id, attempt);
		return new Promise((resolve, reject): void => {
			window.setTimeout((): void => {
				if (integration.id === "billing" && attempt === 1) {
					reject(new Error("The billing provider did not answer"));
				} else {
					resolve();
				}
			}, SYNC_DURATION_MS);
		});
	};
}

const NOOP = (): void => undefined;

const COLUMNS: DataTableColumns<Integration> = [
	{ accessorKey: "name", header: "Integration", size: 200 },
	{
		accessorKey: "events",
		header: "Events today",
		size: 130,
		cell: ({ row }): React.JSX.Element => <Badge variant="info-light">{row.original.events.toLocaleString("en-US")}</Badge>,
	},
	{ accessorKey: "lastSync", header: "Last sync", size: 150, enableSorting: false },
];

function getIntegrationId(integration: Integration): string {
	return integration.id;
}

/**
 * Recipe: row actions with animated icons. Each icon plays a short motion when its button or menu item is hovered or
 * focused, and stands still under reduced motion. Sync returns a promise, so the kit shows a spinner while it runs
 * and a retry if it fails (the billing provider fails once). The icons come from the recipe; the table only places
 * them.
 */
export function DataTableRecipeAnimatedIcons(): React.JSX.Element {
	const rowActions = React.useMemo(
		(): readonly DataTableRowAction<Integration>[] => [
			{
				key: "sync",
				label: "Sync",
				description: "Pull the latest data now",
				inline: true,
				icon: <AnimatedIcon icon={RefreshCw} motion={ICON_MOTIONS.sync} />,
				onSelect: createSync(),
			},
			{ key: "send", label: "Send test event", description: "Check the connection end to end", icon: <AnimatedIcon icon={Send} motion={ICON_MOTIONS.send} />, onSelect: NOOP },
			{
				key: "delete",
				label: "Disconnect",
				description: "Stop syncing and remove the link",
				tone: "destructive",
				icon: <AnimatedIcon icon={Trash2} motion={ICON_MOTIONS.delete} />,
				onSelect: NOOP,
			},
		],
		[],
	);

	return <DataTable data={INTEGRATIONS} columns={COLUMNS} getRowId={getIntegrationId} rowActions={rowActions} />;
}
