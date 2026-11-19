import { RequestMethod } from "@nestjs/common";
import { GUARDS_METADATA, INTERCEPTORS_METADATA, METHOD_METADATA, PATH_METADATA, VERSION_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { DECORATORS } from "@nestjs/swagger";
import { API_VERSION, API_VERSION_PREFIX, ApiVersionSchema } from "@workspace/shared";
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

/** The versions a handler is served at (`@ApiController` sets them); none for an unversioned route. */
const HandlerVersionsSchema = z.array(ApiVersionSchema).optional();

/**
 * Where the current API version serves a controller: `/api/v1/<path>` when every route of it is served at
 * `API_VERSION` (an `@ApiController`), else its path as written (an unversioned `@Controller`).
 */
export function servedPathOf(controller: MetadataTarget): string | undefined {
	const path: string | undefined = reflector.get<string | undefined>(PATH_METADATA, controller);
	const prototype = z.custom<object>((value) => z.looseObject({}).safeParse(value).success).parse(Object.getOwnPropertyDescriptor(controller, "prototype")?.value);
	const routes = Object.getOwnPropertyNames(prototype)
		.filter((name: string): boolean => name !== "constructor")
		.map((name: string): MetadataTarget => handlerOf(prototype, name))
		.filter((handler: MetadataTarget): boolean => reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler) !== undefined);
	const isVersioned =
		routes.length > 0 &&
		routes.every(
			(handler: MetadataTarget): boolean => HandlerVersionsSchema.parse(reflector.get<string[] | undefined>(VERSION_METADATA, handler))?.includes(API_VERSION) === true,
		);
	return isVersioned && path !== undefined ? `${API_VERSION_PREFIX}${path}` : path;
}

/** A controller class's served path (`servedPathOf`) and class-level interceptors. */
export function controllerOf(controller: MetadataTarget): { readonly path: string | undefined; readonly interceptors: readonly object[] } {
	return {
		path: servedPathOf(controller),
		interceptors: reflector.get<object[] | undefined>(INTERCEPTORS_METADATA, controller) ?? [],
	};
}
