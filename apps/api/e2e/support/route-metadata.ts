import { RequestMethod } from "@nestjs/common";
import { GUARDS_METADATA, INTERCEPTORS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { DECORATORS } from "@nestjs/swagger";
import { z } from "zod";

import { getResponseContract, type RouteResponseContract } from "../../src/platform/presentation/http/validation/decorators/zod-response.decorators";

const reflector = new Reflector();

/** What `Reflector.get` reads metadata off: a controller class or one of its methods. */
type MetadataTarget = Parameters<Reflector["get"]>[1];

/** The documented responses of one handler, keyed by HTTP status. */
const DocumentedResponsesSchema = z.record(z.string(), z.looseObject({}));

/** The routing, guard, interceptor and response metadata of one decorated controller method. */
export interface RouteMetadata {
	readonly path: string | undefined;
	readonly method: RequestMethod | undefined;
	readonly guards: readonly object[];
	readonly interceptors: readonly object[];
	readonly contract: RouteResponseContract | undefined;
	/** The documented 2xx statuses: exactly one per handler (one `@Zod*Response`). */
	readonly successStatuses: readonly string[];
}

/** A value `SetMetadata` stores. */
export type MetadataValue = string | number | boolean | object;

/** Reads one string-keyed metadata value (`SetMetadata`) off a handler or class. */
export function metadataOf(key: string, target: MetadataTarget): MetadataValue | undefined {
	return reflector.get<MetadataValue | undefined>(key, target);
}

/** The handler function of a controller method (read off its property descriptor). */
export function handlerOf(prototype: object, name: string): MetadataTarget {
	const descriptor: TypedPropertyDescriptor<MetadataTarget> | undefined = Object.getOwnPropertyDescriptor(prototype, name);
	const handler: MetadataTarget | undefined = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`${name} is not a controller method`);
	}
	return handler;
}

/** The metadata of one decorated controller method. */
export function routeOf(prototype: object, name: string): RouteMetadata {
	const handler = handlerOf(prototype, name);
	const documented = DocumentedResponsesSchema.parse(reflector.get<object | undefined>(DECORATORS.API_RESPONSE, handler) ?? {});
	return {
		path: reflector.get<string | undefined>(PATH_METADATA, handler),
		method: reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler),
		guards: reflector.get<object[] | undefined>(GUARDS_METADATA, handler) ?? [],
		interceptors: reflector.get<object[] | undefined>(INTERCEPTORS_METADATA, handler) ?? [],
		contract: getResponseContract(handler),
		successStatuses: Object.keys(documented).filter((status): boolean => status.startsWith("2")),
	};
}

/** A controller class's path and class-level interceptors. */
export function controllerOf(controller: MetadataTarget): { readonly path: string | undefined; readonly interceptors: readonly object[] } {
	return {
		path: reflector.get<string | undefined>(PATH_METADATA, controller),
		interceptors: reflector.get<object[] | undefined>(INTERCEPTORS_METADATA, controller) ?? [],
	};
}
