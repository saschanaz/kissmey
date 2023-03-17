import { Inject, Injectable } from '@nestjs/common';
import type { ClipsRepository, ClipFavoritesRepository } from '@/models/index.js';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['clip'],

	requireCredential: true,

	kind: 'write:clip-favorite',

	errors: {
		noSuchClip: {
			message: 'No such clip.',
			code: 'NO_SUCH_CLIP',
			id: '4c2aaeae-80d8-4250-9606-26cb1fdb77a5',
		},

		alreadyFavorited: {
			message: 'The clip has already been favorited.',
			code: 'ALREADY_FAVORITED',
			id: '92658936-c625-4273-8326-2d790129256e',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		clipId: { type: 'string', format: 'misskey:id' },
	},
	required: ['clipId'],
} as const;

// eslint-disable-next-line import/no-default-export
@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.clipsRepository)
		private clipsRepository: ClipsRepository,

		@Inject(DI.clipFavoritesRepository)
		private clipFavoritesRepository: ClipFavoritesRepository,

		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const clip = await this.clipsRepository.findOneBy({ id: ps.clipId });
			if (clip == null) {
				throw new ApiError(meta.errors.noSuchClip);
			}
			if ((clip.userId !== me.id) && !clip.isPublic) {
				throw new ApiError(meta.errors.noSuchClip);
			}

			const exist = await this.clipFavoritesRepository.findOneBy({
				clipId: clip.id,
				userId: me.id,
			});

			if (exist != null) {
				throw new ApiError(meta.errors.alreadyFavorited);
			}

			await this.clipFavoritesRepository.insert({
				id: this.idService.genId(),
				createdAt: new Date(),
				clipId: clip.id,
				userId: me.id,
			});
		});
	}
}
