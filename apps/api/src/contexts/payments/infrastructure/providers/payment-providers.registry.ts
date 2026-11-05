import { PaymentProviderNameSchema, type PaymentProviderName } from "@workspace/shared";

import type { PaymentsConfig } from "../../../../config/api-config.schema";
import type { WebhookSignatureVerifier } from "../../../webhooks/inbound/public-api";
import type { PaymentCallbackVerifiersPort } from "../../application/ports/payment-callback-verifiers.port";
import type { PaymentProviderPort } from "../../application/ports/payment-provider.port";
import type { PaymentProvidersPort } from "../../application/ports/payment-providers.port";
import { BillplzPaymentProvider } from "./billplz.provider";
import { ChipPaymentProvider } from "./chip.provider";
import { FakePaymentProvider } from "./fake.provider";
import type { ProviderHttp } from "./provider-http";
import { fetchProviderHttp } from "./provider-http";

/** The gateways configured for this deployment (`PAYMENTS_*`, `BILLPLZ_*`, `CHIP_*`), each built once, with their callback verifiers. */
export class ConfiguredPaymentProviders implements PaymentProvidersPort, PaymentCallbackVerifiersPort {
	private readonly providers: ReadonlyMap<PaymentProviderName, PaymentProviderPort>;
	private readonly verifiers: ReadonlyMap<PaymentProviderName, WebhookSignatureVerifier>;

	public constructor(config: PaymentsConfig, http: ProviderHttp = fetchProviderHttp) {
		const configured: [PaymentProviderName, PaymentProviderPort & { readonly callbackVerifier: WebhookSignatureVerifier }][] = [];
		if (config.billplz !== null) {
			configured.push(["BILLPLZ", new BillplzPaymentProvider(config.billplz, http)]);
		}
		if (config.chip !== null) {
			configured.push(["CHIP", new ChipPaymentProvider(config.chip, http)]);
		}
		if (config.fakeSecret !== null) {
			configured.push(["FAKE", new FakePaymentProvider(config.fakeSecret)]);
		}
		this.providers = new Map(configured);
		this.verifiers = new Map(configured.map(([name, provider]): [PaymentProviderName, WebhookSignatureVerifier] => [name, provider.callbackVerifier]));
	}

	public callbackVerifier(name: PaymentProviderName): WebhookSignatureVerifier | null {
		return this.verifiers.get(name) ?? null;
	}

	public get(name: PaymentProviderName): PaymentProviderPort | null {
		return this.providers.get(name) ?? null;
	}

	public configured(): readonly PaymentProviderName[] {
		return PaymentProviderNameSchema.options.filter((name: PaymentProviderName): boolean => this.providers.has(name));
	}
}
