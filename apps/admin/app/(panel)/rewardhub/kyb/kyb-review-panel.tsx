"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { JsonObjectSchema, KybStatusSchema, type KybStatus } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { Textarea } from "@workspace/ui/components/form/textarea";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { ShieldCheck } from "lucide-react";
import * as React from "react";

const KYB_STATUSES: readonly KybStatus[] = KybStatusSchema.options;

const DEFAULT_DEMO_MERCHANT_ID = "3178a4d1-6915-4eb3-bf84-6fb14e1feb6c";

const DEMO_MERCHANT_IDS: readonly { readonly label: string; readonly id: string }[] = [
	{ label: "KL Brew House (seed)", id: DEFAULT_DEMO_MERCHANT_ID },
	{ label: "Melaka Straits Café (seed)", id: "457401d5-536e-464f-9ae9-4756b6dd5f61" },
];

const DEMO_MERCHANT_LABEL_BY_ID: Readonly<Record<string, string>> = Object.fromEntries(DEMO_MERCHANT_IDS.map((demo) => [demo.id, demo.label]));

function resolveSelectedDemoMerchantId(merchantOrgId: string): string | null {
	return DEMO_MERCHANT_IDS.some((demo) => demo.id === merchantOrgId) ? merchantOrgId : null;
}

function formatDemoMerchantLabel(merchantId: string): string {
	return DEMO_MERCHANT_LABEL_BY_ID[merchantId] ?? merchantId;
}

function resolveInitialMerchantOrgId(initialMerchantOrgId?: string): string {
	if (initialMerchantOrgId !== undefined && initialMerchantOrgId.length > 0) {
		return initialMerchantOrgId;
	}
	return DEFAULT_DEMO_MERCHANT_ID;
}

export interface KybReviewPanelProps {
	readonly initialMerchantOrgId?: string;
}

export default function KybReviewPanel({ initialMerchantOrgId }: KybReviewPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const [merchantOrgId, setMerchantOrgId] = React.useState<string>(() => resolveInitialMerchantOrgId(initialMerchantOrgId));
	const [kybStatus, setKybStatus] = React.useState<KybStatus>("APPROVED");
	const [kybFieldsJson, setKybFieldsJson] = React.useState<string>("");

	const updateKyb = api.rewardsAdmin.updateKyb.useMutation({
		onSuccess: () => {
			toastMessage.success({ title: "KYB updated", description: "Merchant verification status saved." });
		},
		onError: (error) => {
			toastMessage.error({ title: "KYB update failed", description: error.message });
		},
	});

	const handleMerchantOrgIdChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setMerchantOrgId(event.target.value);
	}, []);

	const handleKybStatusChange = React.useCallback((value: string | null): void => {
		const parsed = KybStatusSchema.safeParse(value);
		if (parsed.success) {
			setKybStatus(parsed.data);
		}
	}, []);

	const handleKybFieldsChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setKybFieldsJson(event.target.value);
	}, []);

	const handleDemoSelect = React.useCallback((value: string | null): void => {
		if (value !== null && value.length > 0) {
			setMerchantOrgId(value);
		}
	}, []);

	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const trimmedId = merchantOrgId.trim();
			if (trimmedId.length === 0) {
				toastMessage.error({ title: "Missing merchant ID", description: "Enter a merchant organization UUID." });
				return;
			}

			const trimmedFields = kybFieldsJson.trim();
			if (trimmedFields.length === 0) {
				updateKyb.mutate({ merchantOrgId: trimmedId, kybStatus });
				return;
			}

			const validated = JsonObjectSchema.safeParse(JSON.parse(trimmedFields));
			if (!validated.success) {
				toastMessage.error({ title: "Invalid KYB fields", description: "JSON must be a valid plain object." });
				return;
			}
			updateKyb.mutate({ merchantOrgId: trimmedId, kybStatus, kybFields: validated.data });
		},
		[kybFieldsJson, kybStatus, merchantOrgId, updateKyb],
	);

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">KYB review</h1>
				<p className="text-sm text-muted-foreground">Update know-your-business status for a merchant organization.</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Merchant verification</CardTitle>
					<CardDescription>Seed demo merchants: KL Brew House and Melaka Straits Café. Use their org IDs below or paste any merchant UUID from the database.</CardDescription>
				</CardHeader>
				<CardContent>
					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="space-y-2">
							<Label htmlFor="kyb-demo">Quick pick (seed)</Label>
							<Select value={resolveSelectedDemoMerchantId(merchantOrgId)} onValueChange={handleDemoSelect}>
								<SelectTrigger id="kyb-demo">
									<SelectValue placeholder="Choose a seed merchant" formatValue={formatDemoMerchantLabel} />
								</SelectTrigger>
								<SelectContent>
									{DEMO_MERCHANT_IDS.map((demo) => (
										<SelectItem key={demo.id} value={demo.id}>
											{demo.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="kyb-merchant-id">Merchant org ID</Label>
							<Input id="kyb-merchant-id" value={merchantOrgId} onChange={handleMerchantOrgIdChange} placeholder="UUID" required />
						</div>
						<div className="space-y-2">
							<Label htmlFor="kyb-status">KYB status</Label>
							<Select value={kybStatus} onValueChange={handleKybStatusChange}>
								<SelectTrigger id="kyb-status">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{KYB_STATUSES.map((status) => (
										<SelectItem key={status} value={status}>
											{status}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="kyb-fields">KYB fields (optional JSON)</Label>
							<Textarea id="kyb-fields" value={kybFieldsJson} onChange={handleKybFieldsChange} placeholder='{"documentType":"ssm","verifiedBy":"admin"}' rows={4} />
						</div>
						<Button type="submit" disabled={updateKyb.isPending}>
							<ShieldCheck className="mr-2 size-4" />
							{updateKyb.isPending ? "Saving…" : "Update KYB"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
