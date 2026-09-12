import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { FileScannerInvokePayloadSchema, FileScannerResultSchema, type FileScannerInvokePayload, type FileScannerResult } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { OBJECT_STORAGE } from "../../storage/storage.tokens";
import type { ObjectStorageService } from "../../storage/storage.types";
import { scanBufferWithClamAv } from "../../storage/utils/clamav-instream.util";
import { StoredFileRepository } from "../repositories/stored-file.repository";

@Injectable()
export class FileScanService {
	private readonly logger: Logger = new Logger(FileScanService.name);
	private lambdaClient: LambdaClient | null = null;

	public constructor(
		private readonly config: TypedConfigService,
		private readonly repository: StoredFileRepository,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageService,
	) {}

	public async scanFile(fileId: string): Promise<FileScannerResult> {
		const file = await this.repository.findById(fileId);
		if (file === null) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}

		this.logger.log(`Scanning file ${fileId} via ${this.config.storageScannerMode} (${file.storagePath})`);
		const result = await this.runScan({
			bucket: file.storageBucket,
			key: file.storagePath,
			fileId: file.id,
		});
		this.logger.log(`Scan finished for ${fileId}: ${result.clean ? "clean" : "infected"} (${result.scanResult ?? "no-details"})`);
		return result;
	}

	private async runScan(payload: FileScannerInvokePayload): Promise<FileScannerResult> {
		const parsed = FileScannerInvokePayloadSchema.parse(payload);
		if (this.config.storageScannerMode === "lambda") {
			return this.invokeLambdaScanner(parsed);
		}
		return this.scanWithClamAv(parsed);
	}

	private async scanWithClamAv(payload: FileScannerInvokePayload): Promise<FileScannerResult> {
		const buffer = await this.storage.getObject({ bucket: payload.bucket, path: payload.key });
		if (buffer === null) {
			throw new BadRequestException({ message: "Staging object not found for scan", error: "FILE_OBJECT_MISSING" });
		}
		const result = await scanBufferWithClamAv(buffer, this.config.clamAvHost, this.config.clamAvPort);
		return FileScannerResultSchema.parse({
			clean: result.clean,
			scanResult: result.scanResult,
		});
	}

	private async invokeLambdaScanner(payload: FileScannerInvokePayload): Promise<FileScannerResult> {
		const functionArn = this.config.storageScannerLambdaArn;
		if (functionArn === null) {
			throw new BadRequestException({
				message: "STORAGE_SCANNER_LAMBDA_ARN is required when STORAGE_SCANNER_MODE=lambda",
				error: "SCANNER_NOT_CONFIGURED",
			});
		}
		if (this.config.awsAccessKeyId === null || this.config.awsSecretAccessKey === null) {
			throw new BadRequestException({
				message: "AWS credentials are required to invoke the scanner Lambda",
				error: "SCANNER_NOT_CONFIGURED",
			});
		}

		const client = this.getLambdaClient();
		const response = await client.send(
			new InvokeCommand({
				FunctionName: functionArn,
				Payload: Buffer.from(JSON.stringify(payload)),
			}),
		);

		if (response.FunctionError !== undefined) {
			throw new Error(`Scanner Lambda failed: ${response.FunctionError}`);
		}
		if (response.Payload === undefined) {
			throw new Error("Scanner Lambda returned an empty payload");
		}

		const decoded = new TextDecoder().decode(response.Payload);
		return FileScannerResultSchema.parse(JSON.parse(decoded));
	}

	private getLambdaClient(): LambdaClient {
		if (this.lambdaClient !== null) {
			return this.lambdaClient;
		}
		this.lambdaClient = new LambdaClient({
			region: this.config.awsRegion,
			credentials: {
				accessKeyId: this.config.awsAccessKeyId ?? "",
				secretAccessKey: this.config.awsSecretAccessKey ?? "",
			},
			requestHandler: new NodeHttpHandler({
				connectionTimeout: 5_000,
				requestTimeout: 120_000,
			}),
		});
		return this.lambdaClient;
	}
}
