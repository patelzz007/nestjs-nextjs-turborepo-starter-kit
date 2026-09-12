import { BadRequestException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { Multipart, MultipartFile } from "@fastify/multipart";
import { DocumentMimeTypeSchema } from "@workspace/shared";
import { z } from "zod";

import type { UploadedFileBuffer } from "../../modules/storage/file-upload.types";

export interface ParsedMultipartRequest<TFields> {
	readonly fields: TFields;
	readonly files: UploadedFileBuffer[];
}

const MultipartIterableSchema = z.custom<AsyncIterable<Multipart>>();

const MultipartRequestHandlingSchema = z.object({
	isMultipart: z.function({ input: [], output: z.boolean() }),
	parts: z.function({ input: [], output: MultipartIterableSchema }),
});

type MultipartRequestHandling = z.output<typeof MultipartRequestHandlingSchema>;

const isMultipartFile = (part: Multipart): part is MultipartFile => {
	return part.type === "file";
};

function readMultipartHandling(request: FastifyRequest): MultipartRequestHandling | undefined {
	const parsed = MultipartRequestHandlingSchema.safeParse(request);
	if (!parsed.success || !parsed.data.isMultipart()) {
		return undefined;
	}
	return parsed.data;
}

export async function parseMultipartRequest<TFields>(
	request: FastifyRequest,
	fieldsSchema: z.ZodType<TFields>,
	options?: { readonly maxFiles?: number },
): Promise<ParsedMultipartRequest<TFields>> {
	const multipartHandling = readMultipartHandling(request);
	if (multipartHandling === undefined) {
		throw new BadRequestException("Expected multipart/form-data request");
	}

	const fieldDraft: Record<string, string> = {};
	const files: UploadedFileBuffer[] = [];
	const maxFiles = options?.maxFiles ?? 5;

	for await (const part of multipartHandling.parts()) {
		if (isMultipartFile(part)) {
			if (files.length >= maxFiles) {
				throw new BadRequestException(`You can upload up to ${String(maxFiles)} documents`);
			}
			const buffer = await part.toBuffer();
			const mimeParsed = DocumentMimeTypeSchema.safeParse(part.mimetype);
			if (!mimeParsed.success) {
				throw new BadRequestException("One or more files use a disallowed type.");
			}
			files.push({
				fileName: part.filename,
				mimeType: mimeParsed.data,
				buffer,
			});
			continue;
		}
		const value = z.string().safeParse(part.value);
		if (value.success) {
			fieldDraft[part.fieldname] = value.data;
		}
	}

	const parsedFields = fieldsSchema.safeParse(fieldDraft);
	if (!parsedFields.success) {
		throw new BadRequestException(parsedFields.error.issues[0]?.message ?? "Invalid form fields");
	}

	return { fields: parsedFields.data, files };
}
