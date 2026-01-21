export interface Env {
	IMAGES: R2Bucket;
	PUSH_TOKENS_DO: DurableObjectNamespace;
	PUSH_STATS_DO: DurableObjectNamespace;
	BROADCAST_QUEUE_DO: DurableObjectNamespace;
	ADMIN_SECRET: string;
	ADMIN_EMAILS?: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_CHUNK_SIZE = 100;
const EXPO_CHUNKS_PER_ALARM = 8;
const ALARM_DELAY_MS = 1000;
const TOKEN_CHUNK_SIZE = EXPO_CHUNK_SIZE;
const TOKEN_KEY_PREFIX = 'tokens:';

// The Durable Object (acts like a mini-database)
export class PushTokensDO {
	state: DurableObjectState;
	storage: DurableObjectStorage;

	constructor(state: DurableObjectState) {
		this.state = state;
		this.storage = state.storage;
	}

	// We receive messages here when the worker broadcasts inside the DO
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/add-token' && request.method === 'POST') {
			const { token, email } = await request.json<any>();

			if (!token) {
				return new Response('Missing token', { status: 400 });
			}

			// Key = token itself
			await this.storage.put(token, { token, email: email ?? null });

			return new Response('OK', { status: 200 });
		}

		if (url.pathname === '/remove-token' && request.method === 'POST') {
			const { token } = await request.json<any>();
			if (!token) {
				return new Response('Missing token', { status: 400 });
			}
			await this.storage.delete(token);
			return new Response('OK', { status: 200 });
		}

		if (url.pathname === '/remove-tokens' && request.method === 'POST') {
			const { tokens } = await request.json<any>();
			if (!Array.isArray(tokens) || tokens.length === 0) {
				return new Response('Missing tokens', { status: 400 });
			}
			const normalized = tokens.filter((token) => typeof token === 'string' && token.length > 0);
			if (normalized.length === 0) {
				return new Response('Missing tokens', { status: 400 });
			}
			await this.storage.delete(normalized);
			return Response.json({ removed: normalized.length });
		}

		if (url.pathname === '/get-all' && request.method === 'GET') {
			const list = await this.storage.list();
			const values = [];

			for (const [_, value] of list) {
				values.push(value);
			}

			return Response.json(values);
		}

		return new Response('Not found', { status: 404 });
	}
}

type NotificationStats = {
	id: string;
	title: string | null;
	body: string;
	destination: string | null;
	createdAt: string;
	requestedCount: number;
	successCount: number;
	errorCount: number;
	invalidTokenCount: number;
	openCount: number;
	uniqueOpenCount: number;
	openers: Array<{
		token: string;
		email: string | null;
		openedAt: string;
	}>;
};

const MAX_OPENERS = 200;

export class NotificationStatsDO {
	state: DurableObjectState;
	storage: DurableObjectStorage;

	constructor(state: DurableObjectState) {
		this.state = state;
		this.storage = state.storage;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/init-notification' && request.method === 'POST') {
			const payload = await request.json<NotificationStats>();
			if (!payload?.id) {
				return new Response('Missing notification id', { status: 400 });
			}
			const key = `notification:${payload.id}`;
			const stats: NotificationStats = {
				id: payload.id,
				title: payload.title ?? null,
				body: payload.body,
				destination: payload.destination ?? null,
				createdAt: payload.createdAt ?? new Date().toISOString(),
				requestedCount: payload.requestedCount ?? 0,
				successCount: payload.successCount ?? 0,
				errorCount: payload.errorCount ?? 0,
				invalidTokenCount: payload.invalidTokenCount ?? 0,
				openCount: payload.openCount ?? 0,
				uniqueOpenCount: payload.uniqueOpenCount ?? 0,
				openers: payload.openers ?? [],
			};
			await this.storage.put(key, stats);
			await this.storage.put(`openers:${payload.id}`, {});
			return new Response('OK', { status: 200 });
		}

		if (url.pathname === '/record-delivery' && request.method === 'POST') {
			const { id, successCount, errorCount, invalidTokenCount } = await request.json<any>();
			if (!id) {
				return new Response('Missing notification id', { status: 400 });
			}
			const key = `notification:${id}`;
			const existing = await this.storage.get<NotificationStats>(key);
			if (!existing) {
				return new Response('Not found', { status: 404 });
			}
			const next: NotificationStats = {
				...existing,
				successCount: existing.successCount + (successCount ?? 0),
				errorCount: existing.errorCount + (errorCount ?? 0),
				invalidTokenCount: existing.invalidTokenCount + (invalidTokenCount ?? 0),
			};
			await this.storage.put(key, next);
			return Response.json(next);
		}

		if (url.pathname === '/track-open' && request.method === 'POST') {
			const { id, token, email } = await request.json<any>();
			if (!id) {
				return new Response('Missing notification id', { status: 400 });
			}
			const normalizedToken = typeof token === 'string' && token.length > 0 ? token : null;
			const key = `notification:${id}`;
			const existing = await this.storage.get<NotificationStats>(key);
			if (!existing) {
				return new Response('Not found', { status: 404 });
			}

			if (!normalizedToken) {
				const next: NotificationStats = {
					...existing,
					openCount: existing.openCount + 1,
				};
				await this.storage.put(key, next);
				return Response.json({ ok: true });
			}

			const openerKey = `openers:${id}`;
			const openerMap = (await this.storage.get<Record<string, NotificationStats['openers'][number]>>(openerKey)) ?? {};
			const alreadyOpened = Boolean(openerMap[normalizedToken]);

			const openedAt = new Date().toISOString();
			const entry = {
				token: normalizedToken,
				email: email ?? null,
				openedAt,
			};

			if (!alreadyOpened && Object.keys(openerMap).length < MAX_OPENERS) {
				openerMap[normalizedToken] = entry;
				await this.storage.put(openerKey, openerMap);
			}

			const next: NotificationStats = {
				...existing,
				openCount: existing.openCount + 1,
				uniqueOpenCount: existing.uniqueOpenCount + (alreadyOpened ? 0 : 1),
				openers: alreadyOpened
					? existing.openers
					: [...existing.openers, entry].slice(-MAX_OPENERS),
			};
			await this.storage.put(key, next);

			return Response.json({ ok: true });
		}

		if (url.pathname === '/get' && request.method === 'GET') {
			const id = url.searchParams.get('id');
			if (!id) {
				return new Response('Missing id', { status: 400 });
			}
			const stats = await this.storage.get<NotificationStats>(`notification:${id}`);
			if (!stats) {
				return new Response('Not found', { status: 404 });
			}
			return Response.json(stats);
		}

		if (url.pathname === '/list' && request.method === 'GET') {
			const limit = Number(url.searchParams.get('limit') ?? '20');
			const list = await this.storage.list<NotificationStats>({ prefix: 'notification:' });
			const items = Array.from(list.values());
			items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
			return Response.json(items.slice(0, Number.isFinite(limit) ? limit : 20));
		}

		return new Response('Not found', { status: 404 });
	}
}

type BroadcastJob = {
	notificationId: string;
	title: string;
	body: string;
	path: string | null;
	url: string | null;
	image: string | null;
	destination: string | null;
	chunkIndex: number;
	chunkCount: number;
	requestedCount: number;
	successCount: number;
	errorCount: number;
	invalidTokenCount: number;
	pendingSuccessCount: number;
	pendingErrorCount: number;
	pendingInvalidTokenCount: number;
	createdAt: string;
	updatedAt: string;
	completed: boolean;
};

export class BroadcastQueueDO {
	state: DurableObjectState;
	storage: DurableObjectStorage;
	env: Env;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.storage = state.storage;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/start' && request.method === 'POST') {
			const body = await request.json<any>();
			const tokens = Array.isArray(body?.tokens) ? body.tokens.filter((token: unknown) => typeof token === 'string') : [];

			if (!body?.notificationId || !body?.body) {
				return new Response('Missing notification data', { status: 400 });
			}
			if (tokens.length === 0) {
				return new Response('No tokens', { status: 400 });
			}

			const existing = await this.storage.get<BroadcastJob>('job');
			if (existing && !existing.completed) {
				return new Response('Job already running', { status: 409 });
			}

			const tokenChunks: string[][] = [];
			for (let i = 0; i < tokens.length; i += TOKEN_CHUNK_SIZE) {
				tokenChunks.push(tokens.slice(i, i + TOKEN_CHUNK_SIZE));
			}
			await Promise.all(
				tokenChunks.map((chunk, index) => this.storage.put(`${TOKEN_KEY_PREFIX}${index}`, chunk)),
			);

			const now = new Date().toISOString();
			const job: BroadcastJob = {
				notificationId: body.notificationId,
				title: body.title ?? 'Notification',
				body: body.body,
				path: typeof body.path === 'string' ? body.path : null,
				url: typeof body.url === 'string' ? body.url : null,
				image: typeof body.image === 'string' ? body.image : null,
				destination: typeof body.destination === 'string' ? body.destination : null,
				chunkIndex: 0,
				chunkCount: tokenChunks.length,
				requestedCount: tokens.length,
				successCount: 0,
				errorCount: 0,
				invalidTokenCount: 0,
				pendingSuccessCount: 0,
				pendingErrorCount: 0,
				pendingInvalidTokenCount: 0,
				createdAt: now,
				updatedAt: now,
				completed: false,
			};

			await this.storage.put('job', job);
			await this.storage.setAlarm(Date.now());
			return Response.json({ queued: true, requestedCount: tokens.length });
		}

		if (url.pathname === '/status' && request.method === 'GET') {
			const job = await this.storage.get<BroadcastJob>('job');
			if (!job) {
				return new Response('Not found', { status: 404 });
			}
			return Response.json(job);
		}

		return new Response('Not found', { status: 404 });
	}

	async alarm(): Promise<void> {
		const job = await this.storage.get<BroadcastJob>('job');
		if (!job || job.completed) return;

		try {
			let chunkIndex = job.chunkIndex;
			let successCount = job.successCount;
			let errorCount = job.errorCount;
			let invalidTokenCount = job.invalidTokenCount;
			let pendingSuccessCount = job.pendingSuccessCount;
			let pendingErrorCount = job.pendingErrorCount;
			let pendingInvalidTokenCount = job.pendingInvalidTokenCount;
			const invalidTokens = new Set<string>();

			let chunksProcessed = 0;
			while (chunkIndex < job.chunkCount && chunksProcessed < EXPO_CHUNKS_PER_ALARM) {
				const chunkTokens = await this.storage.get<string[]>(`${TOKEN_KEY_PREFIX}${chunkIndex}`);
				chunkIndex += 1;
				chunksProcessed += 1;
				if (!Array.isArray(chunkTokens) || chunkTokens.length === 0) {
					continue;
				}

				const payloads = chunkTokens.map((token) => ({
					to: token,
					sound: 'default',
					title: job.title,
					body: job.body,
					data: {
						kind: 'broadcast',
						notificationId: job.notificationId,
						...(job.path ? { path: job.path } : {}),
						...(job.url ? { url: job.url } : {}),
						...(job.image ? { image: job.image } : {}),
					},
					...(job.image ? { image: job.image } : {}),
				}));

				let res: Response | null = null;
				try {
					res = await fetch(EXPO_PUSH_URL, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payloads),
					});
				} catch {
					errorCount += chunkTokens.length;
					continue;
				}

				if (!res.ok) {
					errorCount += chunkTokens.length;
					continue;
				}

				let json: any = null;
				try {
					json = await res.json<any>();
				} catch {
					errorCount += chunkTokens.length;
					continue;
				}
				const data = Array.isArray(json?.data) ? json.data : [];
				data.forEach((ticket: any, idx: number) => {
					if (ticket?.status === 'ok') {
						successCount += 1;
						return;
					}
					errorCount += 1;
					const errorType = ticket?.details?.error;
					if (errorType === 'DeviceNotRegistered') {
						const token = chunkTokens[idx];
						if (token) invalidTokens.add(token);
					}
				});
			}

			const deltaSuccess = successCount - job.successCount;
			const deltaError = errorCount - job.errorCount;
			const deltaInvalid = invalidTokens.size;
			pendingSuccessCount += deltaSuccess;
			pendingErrorCount += deltaError;
			pendingInvalidTokenCount += deltaInvalid;

			if (invalidTokens.size > 0) {
				invalidTokenCount += invalidTokens.size;
				try {
					const tokenId = this.env.PUSH_TOKENS_DO.idFromName('global');
					const tokenStub = this.env.PUSH_TOKENS_DO.get(tokenId);
					await tokenStub.fetch('https://do/remove-tokens', {
						method: 'POST',
						body: JSON.stringify({ tokens: Array.from(invalidTokens) }),
					});
				} catch {
					// Best-effort cleanup; stale tokens will be pruned on a future broadcast.
				}
			}

			if (pendingSuccessCount || pendingErrorCount || pendingInvalidTokenCount) {
				try {
					const statsId = this.env.PUSH_STATS_DO.idFromName('global');
					const statsStub = this.env.PUSH_STATS_DO.get(statsId);
					const res = await statsStub.fetch('https://do/record-delivery', {
						method: 'POST',
						body: JSON.stringify({
							id: job.notificationId,
							successCount: pendingSuccessCount,
							errorCount: pendingErrorCount,
							invalidTokenCount: pendingInvalidTokenCount,
						}),
					});
					if (res.ok) {
						pendingSuccessCount = 0;
						pendingErrorCount = 0;
						pendingInvalidTokenCount = 0;
					}
				} catch {
					// Keep pending counts for the next alarm.
				}
			}

			const completed =
				chunkIndex >= job.chunkCount &&
				pendingSuccessCount === 0 &&
				pendingErrorCount === 0 &&
				pendingInvalidTokenCount === 0;
			const updatedJob: BroadcastJob = {
				...job,
				chunkIndex,
				successCount,
				errorCount,
				invalidTokenCount,
				pendingSuccessCount,
				pendingErrorCount,
				pendingInvalidTokenCount,
				updatedAt: new Date().toISOString(),
				completed,
			};

			await this.storage.put('job', updatedJob);
			if (completed && job.chunkCount > 0) {
				const keys = Array.from({ length: job.chunkCount }, (_, index) => `${TOKEN_KEY_PREFIX}${index}`);
				await this.storage.delete(keys);
			}
			if (!completed) {
				await this.storage.setAlarm(Date.now() + ALARM_DELAY_MS);
			}
		} catch (err) {
			console.error('BroadcastQueueDO alarm error', err);
			await this.storage.setAlarm(Date.now() + ALARM_DELAY_MS);
		}
	}
}

// The main Worker (the public API)
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Register token
		if (url.pathname === '/api/register' && request.method === 'POST') {
			return handleRegister(request, env);
		}

		if (url.pathname === '/api/unregister' && request.method === 'POST') {
			return handleUnregister(request, env);
		}

		// Broadcast message
		if (url.pathname === '/api/broadcast' && request.method === 'POST') {
			return handleBroadcast(request, env);
		}

		if (url.pathname === '/api/upload-image' && request.method === 'POST') {
			return handleImageUpload(request, env);
		}

		if (url.pathname === '/api/stats' && request.method === 'GET') {
			return handleStats(request, env);
		}

		if (url.pathname === '/api/track/open' && request.method === 'POST') {
			return handleTrackOpen(request, env);
		}

		return new Response('Not found', { status: 404 });
	},
};

// --- Handlers ---

async function handleRegister(request: Request, env: Env): Promise<Response> {
	const { token, email } = await request.json<any>();

	if (!token) {
		return new Response('Missing token', { status: 400 });
	}

	const id = env.PUSH_TOKENS_DO.idFromName('global');
	const stub = env.PUSH_TOKENS_DO.get(id);

	// Send request inside the DO
	await stub.fetch('https://do/add-token', {
		method: 'POST',
		body: JSON.stringify({ token, email }),
	});

	return new Response('OK', { status: 200 });
}

async function handleUnregister(request: Request, env: Env): Promise<Response> {
	const { token } = await request.json<any>();
	if (!token) {
		return new Response('Missing token', { status: 400 });
	}

	const id = env.PUSH_TOKENS_DO.idFromName('global');
	const stub = env.PUSH_TOKENS_DO.get(id);
	await stub.fetch('https://do/remove-token', { method: 'POST', body: JSON.stringify({ token }) });

	return new Response('OK', { status: 200 });
}

async function handleImageUpload(request: Request, env: Env): Promise<Response> {
	const contentType = request.headers.get('Content-Type') || '';

	if (!contentType.startsWith('image/')) {
		return new Response('Invalid image type', { status: 400 });
	}

	const arrayBuffer = await request.arrayBuffer();
	const extension = contentType.split('/')[1] || 'jpg';
	const filename = `${crypto.randomUUID()}.${extension}`;

	// upload to R2
	await env.IMAGES.put(filename, arrayBuffer, {
		httpMetadata: { contentType },
	});

	const accountHash = 'pub-aacc6477b1484e52a2b5b97c6b861fd5';

	const publicUrl = `https://${accountHash}.r2.dev/${filename}`;

	return Response.json({ url: publicUrl });
}

async function handleBroadcast(request: Request, env: Env): Promise<Response> {
	try {
		const body = await request.json<any>();

		const secret = body.secret;
		const ADMIN_SECRET = env.ADMIN_SECRET;

		if (!secret || secret !== ADMIN_SECRET) {
			return new Response('Unauthorized', { status: 401 });
		}

		const title = body.title ?? 'Notification';
		const message = body.body;
		const path = typeof body.path === 'string' ? body.path : null;
		const url = typeof body.url === 'string' ? body.url : null;
		const image = typeof body.image === 'string' ? body.image : null;
		const audience = typeof body.audience === 'string' ? body.audience : 'all';

		if (!message) {
			return new Response('Missing message body', { status: 400 });
		}

		// Get all tokens from DO
		const id = env.PUSH_TOKENS_DO.idFromName('global');
		const stub = env.PUSH_TOKENS_DO.get(id);

		const res = await stub.fetch('https://do/get-all');
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			return Response.json({ error: text || 'Failed to load tokens' }, { status: 500 });
		}
		const all = await res.json<any[]>();
		const adminEmails = (env.ADMIN_EMAILS ?? '')
			.split(',')
			.map((email) => email.trim().toLowerCase())
			.filter(Boolean);
		if (audience === 'admins' && adminEmails.length === 0) {
			return Response.json({ error: 'Admin emails not configured' }, { status: 400 });
		}
		const tokens = Array.from(
			new Set(
				all
					.filter((entry) => {
						if (audience !== 'admins') return true;
						const email = typeof entry?.email === 'string' ? entry.email.trim().toLowerCase() : '';
						return email && adminEmails.includes(email);
					})
					.map((entry) => entry?.token)
					.filter((token: unknown): token is string => typeof token === 'string' && token.length > 0),
			),
		);

		if (tokens.length === 0) {
			return new Response('No registered tokens', { status: 200 });
		}

		const notificationId = crypto.randomUUID();
		const destination = path ?? url ?? null;

		const statsId = env.PUSH_STATS_DO.idFromName('global');
		const statsStub = env.PUSH_STATS_DO.get(statsId);
		await statsStub.fetch('https://do/init-notification', {
			method: 'POST',
			body: JSON.stringify({
				id: notificationId,
				title,
				body: message,
				destination,
				createdAt: new Date().toISOString(),
				requestedCount: tokens.length,
				successCount: 0,
				errorCount: 0,
				invalidTokenCount: 0,
				openCount: 0,
				uniqueOpenCount: 0,
				openers: [],
			}),
		});

		const queueId = env.BROADCAST_QUEUE_DO.idFromName(notificationId);
		const queueStub = env.BROADCAST_QUEUE_DO.get(queueId);
		const queueRes = await queueStub.fetch('https://do/start', {
			method: 'POST',
			body: JSON.stringify({
				notificationId,
				title,
				body: message,
				path,
				url,
				image,
				destination,
				tokens,
			}),
		});
		if (!queueRes.ok) {
			const text = await queueRes.text().catch(() => '');
			return Response.json({ error: text || 'Failed to queue broadcast' }, { status: 500 });
		}

		return Response.json({
			queued: true,
			notificationId,
			requestedCount: tokens.length,
		}, { status: 202 });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Broadcast failed';
		return Response.json({ error: message }, { status: 500 });
	}
}

async function handleTrackOpen(request: Request, env: Env): Promise<Response> {
	const { notificationId, token, email } = await request.json<any>();

	if (!notificationId || !token) {
		return new Response('Missing notificationId or token', { status: 400 });
	}

	const statsId = env.PUSH_STATS_DO.idFromName('global');
	const statsStub = env.PUSH_STATS_DO.get(statsId);
	await statsStub.fetch('https://do/track-open', {
		method: 'POST',
		body: JSON.stringify({ id: notificationId, token, email }),
	});

	return Response.json({ ok: true });
}

async function handleStats(request: Request, env: Env): Promise<Response> {
	const secret = request.headers.get('x-admin-secret');
	if (!secret || secret !== env.ADMIN_SECRET) {
		return new Response('Unauthorized', { status: 401 });
	}

	const url = new URL(request.url);
	const limit = url.searchParams.get('limit') ?? '20';
	const statsId = env.PUSH_STATS_DO.idFromName('global');
	const statsStub = env.PUSH_STATS_DO.get(statsId);
	const res = await statsStub.fetch(`https://do/list?limit=${encodeURIComponent(limit)}`);
	return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
}
