import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { z } from "zod";

import { handlerOf, type MetadataValue } from "./route-metadata";

const reflector = new Reflector();

/** What `Reflector.get` reads metadata off: a controller class or one of its methods. */
type MetadataTarget = Parameters<Reflector["get"]>[1];

/** A controller class or handler: a function value (an export may also be a constant or a schema). */
const MetadataTargetSchema = z.custom<MetadataTarget>((value) => z.function().safeParse(value).success);

/** A class prototype, kept as the same object: parsing with an object schema would copy only its enumerable keys, and methods are not enumerable. */
const PrototypeSchema = z.custom<object>((value) => z.looseObject({}).safeParse(value).success);

/** A module's exports: an object of named values. */
const ModuleExportsSchema = z.custom<object>((value) => z.looseObject({}).safeParse(value).success);

/** A `@Controller` path or a route path: one string, or several (the first is the one used here). */
const RoutePathSchema = z.union([z.string().transform((path: string): string[] => [path]), z.array(z.string())]);

/** One HTTP route: the handler, its controller, and the joined path Nest serves it at. */
export interface ControllerRoute {
	/** `ControllerName.methodName`, unique across the API. */
	readonly id: string;
	readonly controller: MetadataTarget;
	readonly handler: MetadataTarget;
	/** Controller path and route path joined, with no leading or trailing slash. */
	readonly path: string;
}

function controllerFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((entry: string): string[] => {
		const path: string = join(directory, entry);
		if (statSync(path).isDirectory()) {
			return entry === "__tests__" ? [] : controllerFiles(path);
		}
		return path.endsWith(".controller.ts") ? [path] : [];
	});
}

function pathOf(target: MetadataTarget): string {
	const parsed = RoutePathSchema.safeParse(reflector.get<MetadataValue | undefined>(PATH_METADATA, target));
	if (!parsed.success) {
		return "";
	}
	const [first = ""] = parsed.data;
	return first;
}

function joinPath(...parts: readonly string[]): string {
	return parts
		.flatMap((part: string): string[] => part.split("/"))
		.filter((segment: string): boolean => segment.length > 0)
		.join("/");
}

function routesOf(controller: MetadataTarget): ControllerRoute[] {
	const prototype: object = PrototypeSchema.parse(Object.getOwnPropertyDescriptor(controller, "prototype")?.value);
	return Object.getOwnPropertyNames(prototype)
		.filter((name: string): boolean => name !== "constructor")
		.flatMap((name: string): ControllerRoute[] => {
			const handler: MetadataTarget = handlerOf(prototype, name);
			if (reflector.get<MetadataValue | undefined>(METHOD_METADATA, handler) === undefined) {
				return [];
			}
			return [{ id: `${controller.name}.${name}`, controller, handler, path: joinPath(pathOf(controller), pathOf(handler)) }];
		});
}

/**
 * Every route of every `*.controller.ts` under `sourceRoot`, read from the decorators
 * Nest itself routes by — so a new controller or handler is covered without editing a list.
 */
export async function discoverControllerRoutes(sourceRoot: string): Promise<readonly ControllerRoute[]> {
	const routes: ControllerRoute[] = [];
	for (const file of controllerFiles(sourceRoot)) {
		const exported: object = ModuleExportsSchema.parse(await import(file));
		for (const value of Object.values(exported)) {
			const controller = MetadataTargetSchema.safeParse(value);
			if (controller.success && reflector.get<MetadataValue | undefined>(PATH_METADATA, controller.data) !== undefined) {
				routes.push(...routesOf(controller.data));
			}
		}
	}
	return routes;
}

/** One `SetMetadata` value of a route, the handler's overriding the controller's. */
export function routeMetadataOf(route: ControllerRoute, key: string): MetadataValue | undefined {
	return reflector.getAllAndOverride<MetadataValue | undefined>(key, [route.handler, route.controller]);
}
