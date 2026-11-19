// ============================================
// platform/presentation/http/versioning/api-controller.decorator.ts — a business controller, served on every API version
// ============================================
// Every API version serves every route (ADR 094). `/api/v2/claims/:id` answers with the handler written for v2 when
// there is one, and with the newest older handler otherwise, so a client pinned to v2 never meets a missing route.
// A handler that replaces an older one of the same method and path says from which version, with
// `@SinceApiVersion("v2")`; every other handler serves from the first version on. This class decorator runs after
// every method decorator, so it sees all the handlers of the class: it gives each one its own range of versions, and
// Nest's URI versioning (`enableApiVersioning`) registers each version's literal path (`/api/v1/…`, `/api/v2/…`).

import { Controller, RequestMethod, SetMetadata, Version } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { API_VERSIONS, ApiVersionSchema, type ApiVersion, type VersionedRoutePrefix } from "@workspace/shared";
import { z } from "zod";

const SINCE_API_VERSION_METADATA = "api:since-version";

const reflector = new Reflector();

/** What `Reflector.get` reads metadata off: a controller class or one of its methods. */
type MetadataTarget = Parameters<Reflector["get"]>[1];

/** A class prototype, kept as the same object: parsing with an object schema would copy only its enumerable keys, and methods are not enumerable. */
const PrototypeSchema = z.custom<object>((value) => z.looseObject({}).safeParse(value).success);

const HandlerSchema = z.custom<MetadataTarget>((value) => z.function().safeParse(value).success);

const RequestMethodSchema = z.enum(RequestMethod);

/** A route path as Nest stores it: one string, or several. */
const RoutePathSchema = z.union([z.string(), z.array(z.string())]);

/** The version a handler replaces its older namesakes from (`@SinceApiVersion`). Without it, a handler serves from the first version. */
export function SinceApiVersion(version: ApiVersion): MethodDecorator {
	return SetMetadata(SINCE_API_VERSION_METADATA, version);
}

/** Two handlers of one class answer the same method and path from the same version. */
export class ConflictingApiVersionsError extends Error {
	public constructor(controller: string, route: string, handlers: readonly string[]) {
		super(`${controller}: ${handlers.join(" and ")} both answer ${route} from the same API version; mark the newer one with @SinceApiVersion.`);
		this.name = "ConflictingApiVersionsError";
	}
}

interface VersionedHandler {
	readonly name: string;
	readonly descriptor: PropertyDescriptor;
	/** Where its versions start in `API_VERSIONS`: 0 without `@SinceApiVersion`. */
	readonly start: number;
}

/** The handlers of the class that are routes, grouped by method and path. */
function routeGroups(prototype: object): Map<string, VersionedHandler[]> {
	const groups = new Map<string, VersionedHandler[]>();
	for (const name of Object.getOwnPropertyNames(prototype)) {
		const descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(prototype, name);
		const handler = HandlerSchema.safeParse(descriptor?.value);
		if (name === "constructor" || descriptor === undefined || !handler.success) {
			continue;
		}
		const method = RequestMethodSchema.safeParse(reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler.data));
		if (!method.success) {
			continue;
		}
		const path = RoutePathSchema.parse(reflector.get<string | string[] | undefined>(PATH_METADATA, handler.data));
		const route = `${RequestMethod[method.data]} ${[path].flat().join(", ")}`;
		const since = ApiVersionSchema.optional().parse(reflector.get<ApiVersion | undefined>(SINCE_API_VERSION_METADATA, handler.data));
		const start = since === undefined ? 0 : API_VERSIONS.indexOf(since);
		groups.set(route, [...(groups.get(route) ?? []), { name, descriptor, start }]);
	}
	return groups;
}

/**
 * A business controller at `/api/<version>/<path>`. Each handler serves from its `@SinceApiVersion` (or the first
 * version) up to the version a newer handler of the same method and path replaces it from.
 */
export function ApiController(path: VersionedRoutePrefix): ClassDecorator {
	return (target): void => {
		const prototype = PrototypeSchema.parse(Object.getOwnPropertyDescriptor(target, "prototype")?.value);
		for (const [route, handlers] of routeGroups(prototype)) {
			const ordered = [...handlers].sort((a: VersionedHandler, b: VersionedHandler): number => a.start - b.start);
			ordered.forEach((handler: VersionedHandler, position: number): void => {
				const next: VersionedHandler | undefined = ordered.at(position + 1);
				if (next !== undefined && next.start === handler.start) {
					throw new ConflictingApiVersionsError(target.name, route, [handler.name, next.name]);
				}
				const versions: ApiVersion[] = API_VERSIONS.slice(handler.start, next?.start);
				Version(versions)(prototype, handler.name, handler.descriptor);
			});
		}
		Controller(path)(target);
	};
}
