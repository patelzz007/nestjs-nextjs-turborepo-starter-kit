import type { DynamicModule, NestApplicationOptions } from "@nestjs/common";
import { createObserveModule } from "@nestjs/observe";

export interface ObserveBootstrapResult {
	readonly imports: DynamicModule[];
	readonly instrument: NonNullable<NestApplicationOptions["instrument"]>;
}

export interface ObserveBootstrapConfig {
	readonly appKey: string;
	readonly appSecret: string;
	readonly serviceId: string;
}

/** Load ObserveModule + Nest instrument hook (isolated so the package is not imported when disabled). */
export function bootstrapObserve(config: ObserveBootstrapConfig): ObserveBootstrapResult {
	const setup = createObserveModule();
	const instrument = setup.ObserveInstrument;
	if (instrument === undefined) throw new Error("@nestjs/observe did not provide ObserveInstrument");

	return {
		imports: [
			setup.ObserveModule.forRootAsync({
				useFactory: (): { readonly appKey: string; readonly appSecret: string; readonly serviceId: string } => ({
					appKey: config.appKey,
					appSecret: config.appSecret,
					serviceId: config.serviceId,
				}),
			}),
		],
		instrument,
	};
}
