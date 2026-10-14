import { MerchantRewardStatusBadge } from "@/components/merchant-ui/reward-status";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import type { AppPath } from "@/lib/routes";
import type { RewardStatus } from "@workspace/shared";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/** The form column takes the rest; the preview column is a voucher's width. */
export const REWARD_EDITOR_GRID_CLASS = "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8";

export interface RewardPageBackLinkProps {
	readonly href: AppPath;
	readonly label: string;
}

/** The quiet way back above a reward page's title ("Rewards", "Back to reward"). */
export function RewardPageBackLink({ href, label }: RewardPageBackLinkProps): React.JSX.Element {
	return (
		<Link
			href={href}
			className="inline-flex min-h-8 w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
			<ArrowLeft className="size-4" aria-hidden="true" />
			{label}
		</Link>
	);
}

export interface MerchantRewardEditorLayoutProps {
	readonly heading: string;
	readonly description: string;
	readonly back: RewardPageBackLinkProps;
	/** The saved reward's status beside the heading; none for a new reward. */
	readonly status?: RewardStatus | undefined;
	readonly onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
	/** The form's sections (`MerchantRewardFormFields`), drawn in one panel. */
	readonly fields: React.ReactNode;
	/** The live preview with the save buttons (`MerchantRewardPreview`). */
	readonly preview: React.ReactNode;
}

/**
 * The page around the reward form, shared by creating and editing: the way
 * back, the heading, then one form whose fields fill a single panel and whose
 * preview and save buttons sit beside it. Layout only — the pages own the data.
 */
export function MerchantRewardEditorLayout({ heading, description, back, status, onSubmit, fields, preview }: MerchantRewardEditorLayoutProps): React.JSX.Element {
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-2">
				<RewardPageBackLink {...back} />
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">{heading}</h1>
					{status === undefined ? null : <MerchantRewardStatusBadge status={status} />}
				</div>
				<p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
			</header>

			<form noValidate onSubmit={onSubmit} className={REWARD_EDITOR_GRID_CLASS}>
				<MerchantSurfacePanel className="min-w-0">{fields}</MerchantSurfacePanel>
				{preview}
			</form>
		</div>
	);
}
