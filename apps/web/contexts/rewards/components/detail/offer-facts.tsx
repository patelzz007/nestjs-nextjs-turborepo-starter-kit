import { REWARD_VALUE_CURRENCY } from "@workspace/client/lib/contexts/rewards/reward-offer";
import { PLATFORM_DISPLAY_REGION, type RewardResponse } from "@workspace/shared";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { formatCount } from "@workspace/ui/lib/format/number";
import { CalendarRange, Receipt, ScrollText, Store, UserRound, type LucideIcon } from "lucide-react";
import * as React from "react";

/** Minimum spends are set in currency units and may carry cents. */
const MAX_SPEND_FRACTION_DIGITS = 2;

function formatMinimumSpend(amount: number): string {
	return new Intl.NumberFormat(PLATFORM_DISPLAY_REGION.locale, {
		style: "currency",
		currency: REWARD_VALUE_CURRENCY,
		minimumFractionDigits: 0,
		maximumFractionDigits: MAX_SPEND_FRACTION_DIGITS,
	}).format(amount);
}

/** One claim per person, unless the merchant allows more. */
const DEFAULT_CLAIMS_PER_PERSON = 1;

interface FactProps {
	readonly icon: LucideIcon;
	readonly term: string;
	readonly children: React.ReactNode;
}

function Fact({ icon: Icon, term, children }: FactProps): React.JSX.Element {
	return (
		<div className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
			<Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<div className="min-w-0 space-y-0.5">
				<dt className="text-sm font-medium text-foreground">{term}</dt>
				<dd className="text-sm leading-relaxed text-muted-foreground">{children}</dd>
			</div>
		</div>
	);
}

export interface RewardOfferFactsProps {
	readonly reward: RewardResponse;
}

/** "Good to know": when it is valid, where, the spend and per-person limits, and the merchant's terms. */
export function RewardOfferFacts({ reward }: RewardOfferFactsProps): React.JSX.Element {
	const minimumSpend = reward.rules?.minSpendMyr;
	const claimsPerPerson = reward.rules?.maxUsePerUser ?? DEFAULT_CLAIMS_PER_PERSON;
	const until = formatEpochMs(reward.expiryDate, "date", PLATFORM_DISPLAY_REGION);
	const stores = reward.locationNames ?? [];

	return (
		<section aria-labelledby="reward-good-to-know" className="space-y-4">
			<h2 id="reward-good-to-know" className="text-lg font-semibold tracking-tight">
				Good to know
			</h2>
			<dl className="divide-y divide-border rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
				<Fact icon={CalendarRange} term="Valid">
					{reward.startDate === null ? `Until ${until}` : `${formatEpochMs(reward.startDate, "date", PLATFORM_DISPLAY_REGION)} to ${until}`}
				</Fact>
				<Fact icon={Store} term="Where to use it">
					{reward.locationScopeType === "ALL_LOCATIONS" || stores.length === 0 ? (
						`Any ${reward.organizationName ?? "participating"} store`
					) : (
						<ul className="space-y-0.5">
							{stores.map((store) => (
								<li key={store}>{store}</li>
							))}
						</ul>
					)}
				</Fact>
				<Fact icon={Receipt} term="Minimum spend">
					{minimumSpend === undefined || minimumSpend === 0 ? "None — use it on any bill" : `${formatMinimumSpend(minimumSpend)} on one bill`}
				</Fact>
				<Fact icon={UserRound} term="Limit">
					{claimsPerPerson === DEFAULT_CLAIMS_PER_PERSON ? "One per person" : `Up to ${formatCount(claimsPerPerson, PLATFORM_DISPLAY_REGION.locale)} per person`}
				</Fact>
				<Fact icon={ScrollText} term="Terms">
					{reward.termsConditions === null || reward.termsConditions.trim().length === 0 ? (
						"No extra terms from the merchant."
					) : (
						<span className="whitespace-pre-line">{reward.termsConditions}</span>
					)}
				</Fact>
			</dl>
		</section>
	);
}
