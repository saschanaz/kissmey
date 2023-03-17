process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { signup, api, post, connectStream, startServer } from '../utils.js';
import type { INestApplicationContext } from '@nestjs/common';

describe('Note thread mute', () => {
	let app: INestApplicationContext;

	let alice: any;
	let bob: any;
	let carol: any;

	beforeAll(async () => {
		app = await startServer();
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });
		carol = await signup({ username: 'carol' });
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await app.close();
	});

	test('notes/mentions にミュートしているスレッドの投稿が含まれない', async () => {
		const bobNote = await post(bob, { text: '@alice @carol root note' });
		const aliceReply = await post(alice, { replyId: bobNote.id, text: '@bob @carol child note' });

		await api('/notes/thread-muting/create', { noteId: bobNote.id }, alice);

		const carolReply = await post(carol, { replyId: bobNote.id, text: '@bob @alice child note' });
		const carolReplyWithoutMention = await post(carol, { replyId: aliceReply.id, text: 'child note' });

		const res = await api('/notes/mentions', {}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(Array.isArray(res.body), true);
		assert.strictEqual(res.body.some((note: any) => note.id === bobNote.id), false);
		assert.strictEqual(res.body.some((note: any) => note.id === carolReply.id), false);
		assert.strictEqual(res.body.some((note: any) => note.id === carolReplyWithoutMention.id), false);
	});

	test('ミュートしているスレッドからメンションされても、hasUnreadMentions が true にならない', async () => {
		// 状態リセット
		await api('/i/read-all-unread-notes', {}, alice);

		const bobNote = await post(bob, { text: '@alice @carol root note' });

		await api('/notes/thread-muting/create', { noteId: bobNote.id }, alice);

		const carolReply = await post(carol, { replyId: bobNote.id, text: '@bob @alice child note' });

		const res = await api('/i', {}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(res.body.hasUnreadMentions, false);
	});

	test('ミュートしているスレッドからメンションされても、ストリームに unreadMention イベントが流れてこない', () => new Promise<void>(async done => {
		// 状態リセット
		await api('/i/read-all-unread-notes', {}, alice);

		const bobNote = await post(bob, { text: '@alice @carol root note' });

		await api('/notes/thread-muting/create', { noteId: bobNote.id }, alice);

		let fired = false;

		const ws = await connectStream(alice, 'main', async ({ type, body }) => {
			if (type === 'unreadMention') {
				if (body === bobNote.id) return;
				fired = true;
			}
		});

		const carolReply = await post(carol, { replyId: bobNote.id, text: '@bob @alice child note' });

		setTimeout(() => {
			assert.strictEqual(fired, false);
			ws.close();
			done();
		}, 5000);
	}));

	test('i/notifications にミュートしているスレッドの通知が含まれない', async () => {
		const bobNote = await post(bob, { text: '@alice @carol root note' });
		const aliceReply = await post(alice, { replyId: bobNote.id, text: '@bob @carol child note' });

		await api('/notes/thread-muting/create', { noteId: bobNote.id }, alice);

		const carolReply = await post(carol, { replyId: bobNote.id, text: '@bob @alice child note' });
		const carolReplyWithoutMention = await post(carol, { replyId: aliceReply.id, text: 'child note' });

		const res = await api('/i/notifications', {}, alice);

		assert.strictEqual(res.status, 200);
		assert.strictEqual(Array.isArray(res.body), true);
		assert.strictEqual(res.body.some((notification: any) => notification.note.id === carolReply.id), false);
		assert.strictEqual(res.body.some((notification: any) => notification.note.id === carolReplyWithoutMention.id), false);

		// NOTE: bobの投稿はスレッドミュート前に行われたため通知に含まれていてもよい
	});
});
