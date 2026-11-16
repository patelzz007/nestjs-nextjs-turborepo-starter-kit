"use client";

import * as React from "react";
import {
	ArrowLeftRightIcon,
	BanknoteIcon,
	CircleXIcon,
	ClipboardListIcon,
	CloudUploadIcon,
	CornerUpLeftIcon,
	CreditCardIcon,
	DownloadIcon,
	EyeIcon,
	FolderIcon,
	GlobeIcon,
	KeyIcon,
	LifeBuoyIcon,
	LinkIcon,
	PencilIcon,
	RefreshCwIcon,
	RepeatIcon,
	RocketIcon,
	RotateCcwIcon,
	ShieldCheckIcon,
	Trash2Icon,
	UserMinusIcon,
	UserPlusIcon,
	UserRoundCogIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import {
	Cascader,
	CascaderContent,
	CascaderEmpty,
	CascaderList,
	CascaderPanel,
	CascaderStatus,
	CascaderTrigger,
	useCascaderSelection,
} from "@workspace/ui/components/cascader/cascader";
import { CascaderAction, CascaderFooter } from "@workspace/ui/components/cascader/cascader-footer";
import { CascaderItems } from "@workspace/ui/components/cascader/cascader-item";
import { CascaderBreadcrumb, CascaderInput, CascaderNav, CascaderValue } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderNode } from "@workspace/ui/components/cascader/cascader-types";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";

/** How many permissions one role may hold. */
const MAX_PERMISSIONS = 5;

/* -------------------------------------------------------------------------- */
/*                                 Area icons                                 */
/* -------------------------------------------------------------------------- */

/**
 * One icon per row, declared once here and referenced from the data below.
 *
 * The first level names an AREA of the product, so every root carries the thing
 * it governs: a card for billing, a globe for domains, a key for secrets. The
 * second level names an ACTION, so every leaf carries the verb instead. Handing
 * all eight areas the same shield and all twenty-four permissions the same key
 * made the icon column pure decoration - it repeated what the label already
 * said and told you nothing about the row you were about to tick.
 */
const billingIcon = <CreditCardIcon className="size-4" />;
const membersIcon = <UsersIcon className="size-4" />;
const projectsIcon = <FolderIcon className="size-4" />;
const deploymentsIcon = <RocketIcon className="size-4" />;
const domainsIcon = <GlobeIcon className="size-4" />;
const secretsIcon = <KeyIcon className="size-4" />;
const auditIcon = <ClipboardListIcon className="size-4" />;
const supportIcon = <LifeBuoyIcon className="size-4" />;

/* -------------------------------------------------------------------------- */
/*                                Action icons                                */
/* -------------------------------------------------------------------------- */

/**
 * `viewIcon` is the one glyph that repeats, and the repetition is the point:
 * every "View ..." permission is the same verb, so giving each of them its own
 * mark would invent a distinction the model does not have. Everything else is
 * spent on a verb that appears once.
 */
const viewIcon = <EyeIcon className="size-4" />;
const editIcon = <PencilIcon className="size-4" />;
const deleteIcon = <Trash2Icon className="size-4" />;
const exportIcon = <DownloadIcon className="size-4" />;
const inviteIcon = <UserPlusIcon className="size-4" />;
const removeMemberIcon = <UserMinusIcon className="size-4" />;
const roleIcon = <UserRoundCogIcon className="size-4" />;
const subscriptionIcon = <RepeatIcon className="size-4" />;
const refundIcon = <BanknoteIcon className="size-4" />;
const transferIcon = <ArrowLeftRightIcon className="size-4" />;
const promoteIcon = <CloudUploadIcon className="size-4" />;
/**
 * The counter-clockwise arrow belongs HERE rather than in the footer: rolling a
 * deployment back really does restore a previous state, which is exactly what
 * the glyph promises.
 */
const rollbackIcon = <RotateCcwIcon className="size-4" />;
const attachIcon = <LinkIcon className="size-4" />;
const certificateIcon = <ShieldCheckIcon className="size-4" />;
const rotateIcon = <RefreshCwIcon className="size-4" />;
const replyIcon = <CornerUpLeftIcon className="size-4" />;

/**
 * The footer command's mark, and the one icon in the file chosen against an
 * alternative rather than from the label.
 *
 * A counter-clockwise arrow is the other candidate, but it promises to RESTORE
 * something, and this command has nothing to restore: it empties the selection
 * and leaves you where you started. The circled X says "clear", which is what
 * actually happens, and it is the same mark the trigger's clear button carries
 * - the two entry points are one command offered twice, so they should not be
 * wearing different faces. It also survives the icon switcher intact: all five
 * sets draw an X in a circle, where the counter-clockwise family degrades into
 * an undo hook in two of them.
 */
const clearIcon = <CircleXIcon className="size-4" />;

const permissions: CascaderNode[] = [
	{
		value: "billing",
		label: "Billing",
		icon: billingIcon,
		children: [
			{ value: "billing.read", label: "View invoices", icon: viewIcon },
			{
				value: "billing.write",
				label: "Manage subscription",
				icon: subscriptionIcon,
			},
			{ value: "billing.refund", label: "Issue refunds", icon: refundIcon },
			{ value: "billing.tax", label: "Edit tax details", icon: editIcon },
		],
	},
	{
		value: "members",
		label: "Members",
		icon: membersIcon,
		children: [
			{ value: "members.read", label: "View members", icon: viewIcon },
			{ value: "members.invite", label: "Invite members", icon: inviteIcon },
			{
				value: "members.remove",
				label: "Remove members",
				icon: removeMemberIcon,
			},
			{ value: "members.roles", label: "Assign roles", icon: roleIcon },
		],
	},
	{
		value: "projects",
		label: "Projects",
		icon: projectsIcon,
		children: [
			{ value: "projects.read", label: "View projects", icon: viewIcon },
			{ value: "projects.write", label: "Edit projects", icon: editIcon },
			{
				value: "projects.transfer",
				label: "Transfer projects",
				icon: transferIcon,
			},
			{
				value: "projects.delete",
				label: "Delete projects",
				icon: deleteIcon,
				disabled: true,
			},
		],
	},
	{
		value: "deployments",
		label: "Deployments",
		icon: deploymentsIcon,
		children: [
			{ value: "deployments.read", label: "View deployments", icon: viewIcon },
			{
				value: "deployments.ship",
				label: "Promote to production",
				icon: promoteIcon,
			},
			{ value: "deployments.rollback", label: "Roll back", icon: rollbackIcon },
		],
	},
	{
		value: "domains",
		label: "Domains",
		icon: domainsIcon,
		children: [
			{ value: "domains.read", label: "View domains", icon: viewIcon },
			{ value: "domains.attach", label: "Attach a domain", icon: attachIcon },
			{
				value: "domains.certs",
				label: "Manage certificates",
				icon: certificateIcon,
			},
		],
	},
	{
		value: "secrets",
		label: "Secrets",
		icon: secretsIcon,
		children: [
			{ value: "secrets.read", label: "Read secrets", icon: viewIcon },
			{ value: "secrets.write", label: "Rotate secrets", icon: rotateIcon },
		],
	},
	{
		value: "audit",
		label: "Audit log",
		icon: auditIcon,
		children: [
			{ value: "audit.read", label: "Read the audit log", icon: viewIcon },
			{
				value: "audit.export",
				label: "Export the audit log",
				icon: exportIcon,
			},
		],
	},
	{
		value: "support",
		label: "Support",
		icon: supportIcon,
		children: [
			{ value: "support.read", label: "View tickets", icon: viewIcon },
			{ value: "support.reply", label: "Reply to tickets", icon: replyIcon },
		],
	},
];

/**
 * The clear as a footer COMMAND, reading the selection out of context instead of
 * being handed it. Nothing in here is specific to this example - composed into
 * any panel it clears that cascader - and `isEmpty` is what stops it offering to
 * empty an already empty selection.
 */
function ClearAction(): React.JSX.Element {
	const { clear, isEmpty } = useCascaderSelection();

	return (
		<CascaderAction icon={clearIcon} disabled={isEmpty} onSelect={clear}>
			Clear selection
		</CascaderAction>
	);
}

/**
 * Multi-select. Rows render checkboxes, the popup stays open while you pick,
 * and `max` caps the selection. Deleting projects is disabled to show that a
 * blocked permission stays visible and announced rather than hidden.
 *
 * The clear control stands exactly where the chevron stood, and it is a SIBLING
 * of the trigger rather than something inside it. `CascaderTrigger` renders a
 * real `<button>`, so a button nested in it would be invalid HTML, would fail
 * the `nested-interactive` axe rule, and would open the popup on the way up
 * from its own click. Absolutely positioning it over the trigger's inline end
 * buys the same picture and none of that: the press lands on the clear button
 * and stops there.
 *
 * Two details make the swap read as one control rather than two. `showIcon`
 * takes the chevron away for exactly as long as the clear button is standing in
 * for it, so the two never stack. And `pe-8` reserves the room the chevron used
 * to occupy, so a five-permission summary truncates before it reaches the
 * button instead of sliding underneath it. Both insets are logical (`end-*`,
 * `pe-*`), so the whole arrangement mirrors in RTL.
 *
 * The clear is then offered a SECOND time in the footer, and the two are
 * additive rather than duplicates. The X is the one press out for someone who
 * can already see the summary; the footer row is the named one, in front of you
 * while the popup is open and a Tab away from the search field now that the
 * panel routes Tab past the scroll area, so it is a usable surface rather than a
 * decoration. `CascaderFooter` draws the rule
 * itself, with a `border-t` that sits exactly on the boundary between the list
 * and the footer. An explicit `CascaderSeparator` in here looked equivalent and
 * was not: it stacks its own block margin on top of BOTH containers' padding,
 * which measured 12px above the rule against 6px below, where the panel's own
 * rhythm is 4px after the search field and 0 between rows. The border needs no
 * arithmetic to be symmetric, because it is the boundary rather than a child of
 * one side of it.
 */
export function Cascader2Example(): React.JSX.Element {
	const [value, setValue] = useState<readonly string[]>([]);
	const hasSelection = value.length > 0;
	const handleValueChange = useCallback((next: readonly string[]): void => {
		setValue(next);
	}, []);
	const handleClear = useCallback((): void => {
		setValue([]);
	}, []);

	return (
		<div className="flex w-full justify-center p-4">
			<Cascader multiple max={MAX_PERMISSIONS} items={permissions} value={value} onValueChange={handleValueChange}>
				<div className="relative w-72">
					<CascaderTrigger
						aria-label="Permissions"
						showIcon={!hasSelection}
						render={
							<Button
								variant="outline"
								className={cn(
									/* `transition-colors`, not the Button's own `transition-all`:
                     the gutter below toggles `pe-8`, and `all` animates that
                     padding over 150ms, so clearing slid the label and chevron
                     sideways under the vanishing clear button. Colour still
                     eases for hover and focus. */
									"w-full justify-between gap-2 font-normal transition-colors",
									hasSelection && "pe-8",
								)}
							/>
						}>
						<CascaderValue placeholder="Select permissions" />
					</CascaderTrigger>

					{hasSelection ? (
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label="Clear all permissions"
							onClick={handleClear}
							/* `transition-none`: this button only ever appears and
                 disappears, so there is no state for the Button's inherited
                 `transition-all` to ease between - it only smeared the exit. */
							className="absolute end-1 top-1/2 -translate-y-1/2 transition-none">
							<XIcon />
						</Button>
					) : null}
				</div>

				<CascaderContent className="w-80">
					<CascaderPanel>
						<CascaderNav>
							<CascaderInput />
						</CascaderNav>
						<CascaderBreadcrumb />
						<CascaderEmpty />
						<CascaderList>
							<CascaderItems />
						</CascaderList>

						{/* A SIBLING of the list, never a child of it: `CascaderList`'s own
                Enter handler clicks whatever it contains, so a command living
                inside the rows would fire on the keystroke that commits one. */}
						<CascaderFooter>
							<ClearAction />
						</CascaderFooter>

						<CascaderStatus />
					</CascaderPanel>
				</CascaderContent>
			</Cascader>
		</div>
	);
}
