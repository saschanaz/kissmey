import { Inject, Injectable } from '@nestjs/common';
import { IsNull, MoreThan } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import type { RetentionAggregationsRepository, UsersRepository } from '@/models/index.js';
import { deepClone } from '@/misc/clone.js';
import { IdService } from '@/core/IdService.js';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type Bull from 'bull';

@Injectable()
export class AggregateRetentionProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.retentionAggregationsRepository)
		private retentionAggregationsRepository: RetentionAggregationsRepository,

		private idService: IdService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('aggregate-retention');
	}

	@bindThis
	public async process(job: Bull.Job<Record<string, unknown>>, done: () => void): Promise<void> {
		this.logger.info('Aggregating retention...');

		const now = new Date();
		const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

		// 過去(だいたい)30日分のレコードを取得
		const pastRecords = await this.retentionAggregationsRepository.findBy({
			createdAt: MoreThan(new Date(Date.now() - (1000 * 60 * 60 * 24 * 31))),
		});

		// 今日登録したユーザーを全て取得
		const targetUsers = await this.usersRepository.findBy({
			host: IsNull(),
			createdAt: MoreThan(new Date(Date.now() - (1000 * 60 * 60 * 24))),
		});
		const targetUserIds = targetUsers.map(u => u.id);

		try {
			await this.retentionAggregationsRepository.insert({
				id: this.idService.genId(),
				createdAt: now,
				updatedAt: now,
				dateKey,
				userIds: targetUserIds,
				usersCount: targetUserIds.length,
			});
		} catch (err) {
			if (isDuplicateKeyValueError(err)) {
				this.logger.succ('Skip because it has already been processed by another worker.');
				done();
				return;
			}
			throw err;
		}

		// 今日活動したユーザーを全て取得
		const activeUsers = await this.usersRepository.findBy({
			host: IsNull(),
			lastActiveDate: MoreThan(new Date(Date.now() - (1000 * 60 * 60 * 24))),
		});
		const activeUsersIds = activeUsers.map(u => u.id);

		for (const record of pastRecords) {
			const retention = record.userIds.filter(id => activeUsersIds.includes(id)).length;

			const data = deepClone(record.data);
			data[dateKey] = retention;

			this.retentionAggregationsRepository.update(record.id, {
				updatedAt: now,
				data,
			});
		}

		this.logger.succ('Retention aggregated.');
		done();
	}
}
