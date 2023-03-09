import { type ChildProcess, spawn } from 'node:child_process';
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { Config } from '@/config';
import { DI } from '@/di-symbols.js';

@Injectable()
export class RustPeerServerService implements OnApplicationShutdown {
	#destination: string;
	#process: ChildProcess;

	constructor(
		@Inject(DI.config)
			config: Config,
	) {
		this.#destination = `http://127.0.0.1:${config.port + 1}`;
		this.#process = spawn('cargo', ['run'], {
			stdio: 'inherit',
			cwd: new URL('../../../backend-rust/', import.meta.url),
		});
	}

	onApplicationShutdown(signal?: string | undefined): void {
		this.#process.kill(signal as (NodeJS.Signals | undefined));
	}

	get destination(): string {
		return this.#destination;
	}
}
