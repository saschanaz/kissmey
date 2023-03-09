import cluster from 'node:cluster';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { IsNull } from 'typeorm';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import type { Config } from '@/config.js';
import type { EmojisRepository, UserProfilesRepository, UsersRepository } from '@/models/index.js';
import { DI } from '@/di-symbols.js';
import type Logger from '@/logger.js';
import * as Acct from '@/misc/acct.js';
import { genIdenticon } from '@/misc/gen-identicon.js';
import { createTemp } from '@/misc/create-temp.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { bindThis } from '@/decorators.js';
import { ActivityPubServerService } from './ActivityPubServerService.js';
import { NodeinfoServerService } from './NodeinfoServerService.js';
import { ApiServerService } from './api/ApiServerService.js';
import { StreamingApiServerService } from './api/StreamingApiServerService.js';
import { WellKnownServerService } from './WellKnownServerService.js';
import { FileServerService } from './FileServerService.js';
import { ClientServerService } from './web/ClientServerService.js';
import { OpenApiServerService } from './api/openapi/OpenApiServerService.js';

const _dirname = fileURLToPath(new URL('.', import.meta.url));

@Injectable()
export class ServerService implements OnApplicationShutdown {
	private logger: Logger;
	#fastify: FastifyInstance;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		private userEntityService: UserEntityService,
		private apiServerService: ApiServerService,
		private openApiServerService: OpenApiServerService,
		private streamingApiServerService: StreamingApiServerService,
		private activityPubServerService: ActivityPubServerService,
		private wellKnownServerService: WellKnownServerService,
		private nodeinfoServerService: NodeinfoServerService,
		private fileServerService: FileServerService,
		private clientServerService: ClientServerService,
		private globalEventService: GlobalEventService,
		private loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('server', 'gray', false);
	}

	@bindThis
	public async launch() {
		const fastify = Fastify({
			trustProxy: true,
			logger: !['production', 'test'].includes(process.env.NODE_ENV ?? ''),
		});
		this.#fastify = fastify;

		// HSTS
		// 6months (15552000sec)
		if (this.config.url.startsWith('https') && !this.config.disableHsts) {
			fastify.addHook('onRequest', (request, reply, done) => {
				reply.header('strict-transport-security', 'max-age=15552000; preload');
				done();
			});
		}

		// Register non-serving static server so that the child services can use reply.sendFile.
		// `root` here is just a placeholder and each call must use its own `rootPath`.
		fastify.register(fastifyStatic, {
			root: _dirname,
			serve: false,
		});

		fastify.register(this.apiServerService.createServer, { prefix: '/api' });
		fastify.register(this.openApiServerService.createServer);
		fastify.register(this.fileServerService.createServer);
		fastify.register(this.activityPubServerService.createServer);
		fastify.register(this.nodeinfoServerService.createServer);
		fastify.register(this.wellKnownServerService.createServer);

		fastify.get<{ Params: { path: string }; Querystring: { static?: any; badge?: any; }; }>('/emoji/:path(.*)', async (request, reply) => {
			const path = request.params.path;

			reply.header('Cache-Control', 'public, max-age=86400');

			if (!path.match(/^[a-zA-Z0-9\-_@\.]+?\.webp$/)) {
				reply.code(404);
				return;
			}

			const name = path.split('@')[0].replace('.webp', '');
			const host = path.split('@')[1]?.replace('.webp', '');

			const emoji = await this.emojisRepository.findOneBy({
				// `@.` is the spec of ReactionService.decodeReaction
				host: (host == null || host === '.') ? IsNull() : host,
				name: name,
			});

			reply.header('Content-Security-Policy', 'default-src \'none\'; style-src \'unsafe-inline\'');

			if (emoji == null) {
				if ('fallback' in request.query) {
					return await reply.redirect('/static-assets/emoji-unknown.png');
				} else {
					reply.code(404);
					return;
				}
			}

			let url: URL;
			if ('badge' in request.query) {
				url = new URL(`${this.config.mediaProxy}/emoji.png`);
				// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
				url.searchParams.set('url', emoji.publicUrl || emoji.originalUrl);
				url.searchParams.set('badge', '1');
			} else {
				url = new URL(`${this.config.mediaProxy}/emoji.webp`);
				// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
				url.searchParams.set('url', emoji.publicUrl || emoji.originalUrl);
				url.searchParams.set('emoji', '1');
				if ('static' in request.query) url.searchParams.set('static', '1');
			}

			return await reply.redirect(
				301,
				url.toString(),
			);
		});

		fastify.get<{ Params: { acct: string } }>('/avatar/@:acct', async (request, reply) => {
			const { username, host } = Acct.parse(request.params.acct);
			const user = await this.usersRepository.findOne({
				where: {
					usernameLower: username.toLowerCase(),
					host: (host == null) || (host === this.config.host) ? IsNull() : host,
					isSuspended: false,
				},
				relations: ['avatar'],
			});

			reply.header('Cache-Control', 'public, max-age=86400');

			if (user) {
				reply.redirect(this.userEntityService.getAvatarUrlSync(user));
			} else {
				reply.redirect('/static-assets/user-unknown.png');
			}
		});

		fastify.get<{ Params: { x: string } }>('/identicon/:x', async (request, reply) => {
			const [temp, cleanup] = await createTemp();
			await genIdenticon(request.params.x, fs.createWriteStream(temp));
			reply.header('Content-Type', 'image/png');
			reply.header('Cache-Control', 'public, max-age=86400');
			return fs.createReadStream(temp).on('close', () => cleanup());
		});

		fastify.get<{ Params: { code: string } }>('/verify-email/:code', async (request, reply) => {
			const profile = await this.userProfilesRepository.findOneBy({
				emailVerifyCode: request.params.code,
			});

			if (profile != null) {
				await this.userProfilesRepository.update({ userId: profile.userId }, {
					emailVerified: true,
					emailVerifyCode: null,
				});

				this.globalEventService.publishMainStream(profile.userId, 'meUpdated', await this.userEntityService.pack(profile.userId, { id: profile.userId }, {
					detail: true,
					includeSecrets: true,
				}));

				reply.code(200);
				return 'Verify succeeded!';
			} else {
				reply.code(404);
				return;
			}
		});

		fastify.register(this.clientServerService.createServer);

		this.streamingApiServerService.attachStreamingApi(fastify.server);

		fastify.server.on('error', err => {
			switch ((err as any).code) {
				case 'EACCES':
					this.logger.error(`You do not have permission to listen on port ${this.config.port}.`);
					break;
				case 'EADDRINUSE':
					this.logger.error(`Port ${this.config.port} is already in use by another process.`);
					break;
				default:
					this.logger.error(err);
					break;
			}

			if (cluster.isWorker) {
				process.send!('listenFailed');
			} else {
				// disableClustering
				process.exit(1);
			}
		});

		fastify.listen({ port: this.config.port, host: '0.0.0.0' });

		await fastify.ready();
	}

	async onApplicationShutdown(signal: string): Promise<void> {
		await this.#fastify.close();
	}
}
