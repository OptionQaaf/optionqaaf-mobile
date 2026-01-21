export interface Env {
	IMAGES: R2Bucket;
	PUSH_TOKENS_DO: DurableObjectNamespace;
	PUSH_STATS_DO: DurableObjectNamespace;
	ADMIN_SECRET: string;
}

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
			if (!id || !token) {
				return new Response('Missing notification id or token', { status: 400 });
			}
			const key = `notification:${id}`;
			const existing = await this.storage.get<NotificationStats>(key);
			if (!existing) {
				return new Response('Not found', { status: 404 });
			}

			const openerKey = `openers:${id}`;
			const openerMap = (await this.storage.get<Record<string, NotificationStats['openers'][number]>>(openerKey)) ?? {};
			const alreadyOpened = Boolean(openerMap[token]);

			const openedAt = new Date().toISOString();
			const entry = {
				token,
				email: email ?? null,
				openedAt,
			};

			if (!alreadyOpened && Object.keys(openerMap).length < MAX_OPENERS) {
				openerMap[token] = entry;
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

	if (!message) {
		return new Response('Missing message body', { status: 400 });
	}

	// Get all tokens from DO
	const id = env.PUSH_TOKENS_DO.idFromName('global');
	const stub = env.PUSH_TOKENS_DO.get(id);

	const res = await stub.fetch('https://do/get-all');
	const all = await res.json<any[]>();

	if (all.length === 0) {
		return new Response('No registered tokens', { status: 200 });
	}

	const notificationId = crypto.randomUUID();
	const destination = path ?? url ?? null;

	// Build Expo push objects
	const payloads = all.map((entry) => ({
		to: entry.token,
		sound: 'default',
		title,
		body: message,
		data: {
			kind: 'broadcast',
			notificationId,
			...(path ? { path } : {}),
			...(url ? { url } : {}),
			...(image ? { image } : {}),
		},
		...(image ? { image } : {}),
	}));

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
			requestedCount: payloads.length,
			successCount: 0,
			errorCount: 0,
			invalidTokenCount: 0,
			openCount: 0,
			uniqueOpenCount: 0,
			openers: [],
		}),
	});

	const invalidTokens = new Set<string>();
	let successCount = 0;
	let errorCount = 0;

	const chunkSize = 100;
	for (let i = 0; i < payloads.length; i += chunkSize) {
		const chunk = payloads.slice(i, i + chunkSize);
		const res = await fetch('https://exp.host/--/api/v2/push/send', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(chunk),
		});

		if (!res.ok) {
			errorCount += chunk.length;
			continue;
		}

		const json = await res.json<any>();
		const data = Array.isArray(json?.data) ? json.data : [];
		data.forEach((ticket: any, index: number) => {
			if (ticket?.status === 'ok') {
				successCount += 1;
				return;
			}
			errorCount += 1;
			const errorType = ticket?.details?.error;
			if (errorType === 'DeviceNotRegistered') {
				invalidTokens.add(chunk[index]?.to);
			}
		});
	}

	if (invalidTokens.size > 0) {
		const tokenId = env.PUSH_TOKENS_DO.idFromName('global');
		const tokenStub = env.PUSH_TOKENS_DO.get(tokenId);
		await Promise.all(
			Array.from(invalidTokens).map((token) =>
				tokenStub.fetch('https://do/remove-token', {
					method: 'POST',
					body: JSON.stringify({ token }),
				}),
			),
		);
	}

	await statsStub.fetch('https://do/record-delivery', {
		method: 'POST',
		body: JSON.stringify({
			id: notificationId,
			successCount,
			errorCount,
			invalidTokenCount: invalidTokens.size,
		}),
	});

	return Response.json({
		notificationId,
		requestedCount: payloads.length,
		successCount,
		errorCount,
		invalidTokenCount: invalidTokens.size,
	});
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
