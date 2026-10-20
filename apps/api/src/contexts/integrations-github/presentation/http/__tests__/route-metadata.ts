import { isDeepStrictEqual } from "node:util";

import { Reflector } from "@nestjs/core";
import { z } from "zod";

const reflector = new Reflector();

const MetadataKeysSchema = z.array(z.union([z.string(), z.symbol()]));

/** A method of a controller's prototype, typed by its name. */
export function handlerOf<TController extends object, TKey extends keyof TController>(prototype: TController, key: TKey): TController[TKey] {
	const descriptor: TypedPropertyDescriptor<TController[TKey]> | undefined = Object.getOwnPropertyDescriptor(prototype, key);
	const handler: TController[TKey] | undefined = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`${String(key)} is not a method`);
	}
	return handler;
}

/**
 * The metadata key a method decorator stores `expected` under — found by applying the decorator to a probe,
 * so a spec names the key through the decorator itself instead of reaching into another layer for its constant.
 */
export function metadataKeyOf(decorator: MethodDecorator, expected: object): string | symbol {
	class Probe {
		public route(): void {
			// The probe only carries the decorator's metadata.
		}
	}
	const descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(Probe.prototype, "route");
	if (descriptor === undefined) {
		throw new Error("probe has no route");
	}
	decorator(Probe.prototype, "route", descriptor);
	const handler = handlerOf(Probe.prototype, "route");
	const key = MetadataKeysSchema.parse(Reflect.getOwnMetadataKeys(handler)).find((candidate: string | symbol): boolean =>
		isDeepStrictEqual(reflector.get<object | undefined>(candidate, handler), expected),
	);
	if (key === undefined) {
		throw new Error("the decorator stored no metadata equal to the expected value");
	}
	return key;
}
