"use client";

import { MerchantRewardEditorPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import {
	checkPaymentForm,
	EMPTY_PAYMENT_FORM,
	idempotencyKeyFor,
	PAYMENT_PROVIDER_DESCRIPTIONS,
	PAYMENT_PROVIDER_LABELS,
	type PaymentFormField,
	type PaymentFormValues,
	type SentIdempotencyKey,
} from "@/contexts/payments/lib/payments";
import { useCreatePayment } from "@/contexts/payments/lib/use-create-payment";
import { MerchantCapabilityGate } from "@/contexts/tenancy";
import { userSafeErrorMessage } from "@/lib/query/query-policy";
import { tenantRoutes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { MERCHANT_CAPABILITY, newRowId, PAYMENT_DESCRIPTION_MAX_LENGTH, PaymentProviderNameSchema, type PaymentProvidersResponse } from "@workspace/shared";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { toastMessage } from "@workspace/ui/components/toast";
import { useRouter } from "next/navigation";
import * as React from "react";

/** The text boxes of the form; one change handler serves them all, by the input's `name`. */
const TEXT_FIELDS: readonly PaymentFormField[] = ["amount", "description", "payerName", "payerEmail"];

export interface MerchantNewPaymentPageViewProps {
	readonly tenantSlug: string;
}

/** `/t/:tenantSlug/payments/new` — ask a customer for a payment through one of the gateways set up here. */
export function MerchantNewPaymentPageView(props: MerchantNewPaymentPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.managePayments} loading={<MerchantRewardEditorPageSkeleton />}>
			<NewPaymentContent {...props} />
		</MerchantCapabilityGate>
	);
}

function NewPaymentContent({ tenantSlug }: MerchantNewPaymentPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const providersQuery = api.tenantPayments.providers.useQuery({ tenantSlug });
	const routes = tenantRoutes(tenantSlug).payments;
	const providers = providersQuery.data?.data.providers;

	let body: React.JSX.Element;
	if (providersQuery.isError) {
		body = (
			<p className="text-sm text-muted-foreground">{userSafeErrorMessage(providersQuery.error, "Couldn't load the payment methods. Check your connection and try again.")}</p>
		);
	} else if (providers === undefined) {
		body = <MerchantRewardEditorPageSkeleton />;
	} else if (providers.length === 0) {
		body = (
			<Alert variant="warning">
				<AlertTitle>Payments aren&apos;t set up yet</AlertTitle>
				<AlertDescription>The platform hasn&apos;t connected a payment gateway (Billplz or CHIP). Ask the platform team to add its keys, then come back.</AlertDescription>
			</Alert>
		);
	} else {
		body = <NewPaymentForm tenantSlug={tenantSlug} providers={providers} />;
	}

	return (
		<div className="flex flex-col gap-6">
			<MerchantPageHeader
				title="New payment"
				description="The customer gets a secure page to pay on. You see it here the moment it's paid."
				actions={
					<a href={routes.list} className={buttonVariants({ variant: "outline" })}>
						All payments
					</a>
				}
			/>
			{body}
		</div>
	);
}

/** The payments list as a full address: where the payer comes back to after checkout (browser only). */
function paymentsListUrl(listPath: string): string {
	return new URL(listPath, window.location.origin).href;
}

interface NewPaymentFormProps {
	readonly tenantSlug: string;
	readonly providers: PaymentProvidersResponse["providers"];
}

function NewPaymentForm({ tenantSlug, providers }: NewPaymentFormProps): React.JSX.Element {
	const router = useRouter();
	const queryClient = useQueryClient();
	const routes = tenantRoutes(tenantSlug).payments;
	const [onlyProvider] = providers;
	const [values, setValues] = React.useState<PaymentFormValues>({
		...EMPTY_PAYMENT_FORM,
		provider: providers.length === 1 && onlyProvider !== undefined ? onlyProvider.name : "",
	});
	const [showErrors, setShowErrors] = React.useState(false);
	const sentKey = React.useRef<SentIdempotencyKey | null>(null);

	const create = useCreatePayment();

	// Checked only once the merchant pressed Create: that runs in the browser, where the page's own address
	// (the payer's way back after checkout) is known.
	const shownCheck = showErrors ? checkPaymentForm(values, paymentsListUrl(routes.list)) : null;
	const errors = shownCheck !== null && !shownCheck.ok ? shownCheck.errors : {};

	const handleTextChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const { name, value } = event.currentTarget;
			const field = TEXT_FIELDS.find((candidate) => candidate === name);
			if (field !== undefined) {
				setValues((current) => ({ ...current, [field]: value }));
			}
		},
		[setValues],
	);
	const handleProviderChange = React.useCallback(
		(value: string): void => {
			const provider = PaymentProviderNameSchema.safeParse(value);
			if (provider.success) {
				setValues((current) => ({ ...current, provider: provider.data }));
			}
		},
		[setValues],
	);
	const { mutate } = create;
	const handleSubmit = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setShowErrors(true);
			const check = checkPaymentForm(values, paymentsListUrl(routes.list));
			if (!check.ok) {
				return;
			}
			// The same request keeps its key, so a retry after a lost answer never takes a second payment.
			sentKey.current = idempotencyKeyFor(sentKey.current, check.request, newRowId);
			mutate(
				{ tenantSlug, request: check.request, idempotencyKey: sentKey.current.key },
				{
					onSuccess: (payment): void => {
						void queryClient.invalidateQueries({ queryKey: apiRouter.tenantPayments.payments.scopeKey({ tenantSlug }) });
						toastMessage.success({ title: "Payment created", description: "Send the customer the checkout link, or open it here." });
						router.push(routes.detail(payment.id));
					},
				},
			);
		},
		[mutate, queryClient, router, routes, setShowErrors, tenantSlug, values],
	);

	return (
		<form onSubmit={handleSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
			<Card className="flex flex-col gap-6 p-5 sm:p-6">
				<FieldSet>
					<FieldLegend>How the customer pays</FieldLegend>
					<RadioGroup value={values.provider} onValueChange={handleProviderChange} aria-invalid={errors.provider !== undefined} className="gap-2">
						{providers.map((provider): React.JSX.Element => (
							<FieldLabel
								key={provider.name}
								htmlFor={`payment-provider-${provider.name}`}
								className="flex items-start gap-3 rounded-lg border border-border p-3 has-data-checked:border-primary has-data-checked:bg-primary/5">
								<RadioGroupItem id={`payment-provider-${provider.name}`} value={provider.name} className="mt-0.5" />
								<span className="flex flex-col gap-0.5">
									<span className="text-sm font-medium text-foreground">{PAYMENT_PROVIDER_LABELS[provider.name]}</span>
									<span className="text-xs font-normal text-muted-foreground">{PAYMENT_PROVIDER_DESCRIPTIONS[provider.name]}</span>
								</span>
							</FieldLabel>
						))}
					</RadioGroup>
					<FieldError>{errors.provider}</FieldError>
				</FieldSet>

				<Field>
					<FieldLabel htmlFor="payment-amount">Amount</FieldLabel>
					<InputGroup className="max-w-56">
						<InputGroupAddon>
							<InputGroupText>RM</InputGroupText>
						</InputGroupAddon>
						<InputGroupInput
							id="payment-amount"
							name="amount"
							inputMode="decimal"
							autoComplete="off"
							placeholder="0.00"
							value={values.amount}
							onChange={handleTextChange}
							aria-invalid={errors.amount !== undefined}
							className="tabular-nums"
						/>
					</InputGroup>
					<FieldError>{errors.amount}</FieldError>
				</Field>

				<Field>
					<FieldLabel htmlFor="payment-description">What it&apos;s for</FieldLabel>
					<Input
						id="payment-description"
						name="description"
						placeholder="Catering order, 12 June"
						maxLength={PAYMENT_DESCRIPTION_MAX_LENGTH}
						value={values.description}
						onChange={handleTextChange}
						aria-invalid={errors.description !== undefined}
					/>
					<FieldDescription>The customer sees this on the payment page and the receipt.</FieldDescription>
					<FieldError>{errors.description}</FieldError>
				</Field>

				<div className="grid gap-6 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="payment-payer-name">Customer&apos;s name</FieldLabel>
						<Input
							id="payment-payer-name"
							name="payerName"
							autoComplete="off"
							value={values.payerName}
							onChange={handleTextChange}
							aria-invalid={errors.payerName !== undefined}
						/>
						<FieldError>{errors.payerName}</FieldError>
					</Field>
					<Field>
						<FieldLabel htmlFor="payment-payer-email">Customer&apos;s email</FieldLabel>
						<Input
							id="payment-payer-email"
							name="payerEmail"
							type="email"
							autoComplete="off"
							value={values.payerEmail}
							onChange={handleTextChange}
							aria-invalid={errors.payerEmail !== undefined}
						/>
						<FieldError>{errors.payerEmail}</FieldError>
					</Field>
				</div>
			</Card>

			<aside className="flex flex-col gap-4 lg:sticky lg:top-6">
				<Card className="flex flex-col gap-3 p-5 text-sm text-muted-foreground">
					<p>You get a checkout link to send the customer, or to open on this device at the counter.</p>
					<p>Asking twice by accident is safe: pressing Create again for the same details returns the same payment.</p>
				</Card>
				{create.error === null ? null : (
					<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
						{userSafeErrorMessage(create.error, "The payment wasn't created. Check your connection and try again.")}
					</p>
				)}
				<Button type="submit" disabled={create.isPending}>
					{create.isPending ? "Creating…" : "Create payment"}
				</Button>
			</aside>
		</form>
	);
}
