// ============================================
// machine.ts — reading this machine (Linux and macOS alike)
// ============================================
// Design patterns:
//   - ADAPTER: `SystemInformationMachine` turns `systeminformation` (and `node:os`, `node:fs`) into
//     the shared `OpsServerLive` / `OpsHostFacts` shapes; the rest of the agent sees only `Machine`.
//   - Honest gaps: a figure a platform does not report (CPU steal and iowait outside Linux, open
//     files on macOS) is `null`, never a made-up zero.

import { readFile, statfs } from "node:fs/promises";
import { loadavg } from "node:os";

import { epochMs, OPS_MAX_DISKS, OPS_TOP_PROCESS_COUNT, type OpsHostFacts, type OpsServerLive } from "@workspace/shared";
import si from "systeminformation";

/** What the agent needs to know about the machine (a fake in the tests). */
export interface Machine {
	facts(): Promise<OpsHostFacts>;
	sample(): Promise<OpsServerLive>;
}

const KIB = 1_024;
const HUNDRED = 100;
const LINUX = "linux";
/** Pseudo and container file systems that are not "the disk". */
const IGNORED_FS: ReadonlySet<string> = new Set(["tmpfs", "devtmpfs", "overlay", "squashfs", "devfs", "autofs", "proc", "sysfs"]);

function clampPercent(value: number): number {
	return Math.min(HUNDRED, Math.max(0, Number.isFinite(value) ? value : 0));
}

function nonNegative(value: number | null | undefined): number {
	return value === null || value === undefined || !Number.isFinite(value) ? 0 : Math.max(0, value);
}

/** Percent of inodes in use on a mount (`statfs`), or `null` when the file system does not count them. */
async function inodesPercent(mount: string): Promise<number | null> {
	try {
		const stats = await statfs(mount);
		return stats.files > 0 ? clampPercent(((stats.files - stats.ffree) / stats.files) * HUNDRED) : null;
	} catch {
		return null;
	}
}

/** Linux iowait between two `/proc/stat` readings, in percent. */
export class IowaitMeter {
	private _previous: { readonly iowait: number; readonly total: number } | null = null;

	public constructor(private readonly _readStat: () => Promise<string> = (): Promise<string> => readFile("/proc/stat", "utf8")) {}

	public async percent(): Promise<number | null> {
		const line: string | undefined = (await this._readStat()).split("\n").find((entry) => entry.startsWith("cpu "));
		const fields: number[] = (line ?? "").trim().split(/\s+/).slice(1).map(Number);
		const iowaitIndex = 4;
		const iowait: number | undefined = fields.at(iowaitIndex);
		if (iowait === undefined || fields.some((value) => !Number.isFinite(value))) {
			return null;
		}
		const total: number = fields.reduce((sum, value) => sum + value, 0);
		const before = this._previous;
		this._previous = { iowait, total };
		if (before === null || total <= before.total) {
			return null;
		}
		return clampPercent(((iowait - before.iowait) / (total - before.total)) * HUNDRED);
	}
}

export class SystemInformationMachine implements Machine {
	private readonly _iowait = new IowaitMeter();

	public async facts(): Promise<OpsHostFacts> {
		const [os, cpu, memory] = await Promise.all([si.osInfo(), si.cpu(), si.mem()]);
		const time = si.time();
		return {
			hostname: os.hostname || "unknown",
			os: `${os.distro} ${os.release}`.trim() || os.platform,
			kernel: os.kernel || "unknown",
			cpuModel: `${cpu.manufacturer} ${cpu.brand}`.trim() || "unknown",
			cpuCores: Math.max(1, cpu.cores),
			memoryTotalBytes: Math.round(memory.total),
			uptimeSeconds: Math.round(nonNegative(time.uptime)),
		};
	}

	public async sample(): Promise<OpsServerLive> {
		const linux: boolean = process.platform === LINUX;
		const [load, memory, disks, fsStats, diskIo, network, processes, connections, openFiles] = await Promise.all([
			si.currentLoad(),
			si.mem(),
			si.fsSize(),
			si.fsStats(),
			si.disksIO(),
			si.networkStats(),
			si.processes(),
			si.networkConnections(),
			linux ? si.fsOpenFiles() : Promise.resolve(null),
		]);
		const [load1 = 0, load5 = 0, load15 = 0] = loadavg();
		const realDisks = disks.filter((disk) => !IGNORED_FS.has(disk.type) && disk.size > 0).slice(0, OPS_MAX_DISKS);
		return {
			sampledAt: epochMs(Date.now()),
			cpuPercent: clampPercent(load.currentLoad),
			perCorePercent: load.cpus.map((core) => clampPercent(core.load)),
			stealPercent: linux ? clampPercent(load.currentLoadSteal) : null,
			iowaitPercent: linux ? await this._iowait.percent() : null,
			load1: nonNegative(load1),
			load5: nonNegative(load5),
			load15: nonNegative(load15),
			memoryUsedBytes: Math.round(nonNegative(memory.active)),
			memoryTotalBytes: Math.round(nonNegative(memory.total)),
			swapUsedBytes: Math.round(nonNegative(memory.swapused)),
			swapTotalBytes: Math.round(nonNegative(memory.swaptotal)),
			disks: await Promise.all(
				realDisks.map(async (disk) => ({
					mount: disk.mount,
					usedBytes: Math.round(nonNegative(disk.used)),
					totalBytes: Math.round(nonNegative(disk.size)),
					inodesPercent: await inodesPercent(disk.mount),
				})),
			),
			diskReadBytesPerSec: nonNegative(fsStats.rx_sec),
			diskWriteBytesPerSec: nonNegative(fsStats.wx_sec),
			diskReadIops: diskIo.rIO_sec === null ? null : nonNegative(diskIo.rIO_sec),
			diskWriteIops: diskIo.wIO_sec === null ? null : nonNegative(diskIo.wIO_sec),
			netRxBytesPerSec: network.reduce((sum, nic) => sum + nonNegative(nic.rx_sec), 0),
			netTxBytesPerSec: network.reduce((sum, nic) => sum + nonNegative(nic.tx_sec), 0),
			tcpConnections: connections.filter((connection) => connection.protocol.startsWith("tcp") && connection.state === "ESTABLISHED").length,
			openFiles: openFiles === null ? null : Math.round(nonNegative(openFiles.allocated)),
			processCount: processes.all,
			topProcesses: [...processes.list]
				.sort((left, right) => right.cpu - left.cpu)
				.slice(0, OPS_TOP_PROCESS_COUNT)
				.map((process) => ({
					pid: process.pid,
					name: process.name.slice(0, 120) || "unknown",
					cpuPercent: nonNegative(process.cpu),
					memoryBytes: Math.round(nonNegative(process.memRss) * KIB),
				})),
		};
	}
}
