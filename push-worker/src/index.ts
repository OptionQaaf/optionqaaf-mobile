import {
	StoredPopup,
	PopupPayload,
	meetsMinimumVersion,
	resolveViewerAudience,
	isAudienceMatch,
} from "./popup"

export interface Env {
	IMAGES: R2Bucket;
	PUSH_TOKENS_DO: DurableObjectNamespace;
	PUSH_STATS_DO: DurableObjectNamespace;
	BROADCAST_QUEUE_DO: DurableObjectNamespace;
	POPUP_DO: DurableObjectNamespace;
	ADMIN_SECRET: string;
	ADMIN_EMAILS?: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_CHUNK_SIZE = 100;
const EXPO_CHUNKS_PER_ALARM = 8;
const ALARM_DELAY_MS = 1000;
const MAX_ALARM_BACKOFF_MS = 10000;
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
	backoffMs: number;
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
				backoffMs: ALARM_DELAY_MS,
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
			// Track repeated Expo push failures so we can back off alarm scheduling.
			let networkFailure = false;

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
					android_channel_id: 'default',
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
					networkFailure = true;
					continue;
				}

				if (!res.ok) {
					errorCount += chunkTokens.length;
					networkFailure = true;
					continue;
				}

				let json: any = null;
				try {
					json = await res.json<any>();
				} catch {
					errorCount += chunkTokens.length;
					networkFailure = true;
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
			// Back off alarm scheduling if the Expo push API was unreachable.
			const nextBackoffMs = networkFailure
				? Math.min((job.backoffMs ?? ALARM_DELAY_MS) * 2, MAX_ALARM_BACKOFF_MS)
				: ALARM_DELAY_MS;
			const updatedJob: BroadcastJob = {
				...job,
				chunkIndex,
				successCount,
				errorCount,
				invalidTokenCount,
				pendingSuccessCount,
				pendingErrorCount,
				pendingInvalidTokenCount,
				backoffMs: nextBackoffMs,
				updatedAt: new Date().toISOString(),
				completed,
			};

			await this.storage.put('job', updatedJob);
			if (completed && job.chunkCount > 0) {
				const keys = Array.from({ length: job.chunkCount }, (_, index) => `${TOKEN_KEY_PREFIX}${index}`);
				await this.storage.delete(keys);
			}
			if (!completed) {
				await this.storage.setAlarm(Date.now() + nextBackoffMs);
			}
		} catch (err) {
			console.error('BroadcastQueueDO alarm error', err);
			const fallbackDelay = Math.min((job.backoffMs ?? ALARM_DELAY_MS) * 2, MAX_ALARM_BACKOFF_MS);
			await this.storage.setAlarm(Date.now() + fallbackDelay);
		}
	}
}

const POPUP_DO_NAME = "popup-manager"
const POPUP_CURRENT_KEY = "popup:current"
const POPUP_SEEN_PREFIX = "popupSeen:"

export class PopupDO {
	state: DurableObjectState
	storage: DurableObjectStorage

	constructor(state: DurableObjectState) {
		this.state = state
		this.storage = state.storage
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url)
		if (url.pathname === "/current" && request.method === "GET") {
			const current = (await this.storage.get<StoredPopup>(POPUP_CURRENT_KEY)) ?? null
			return Response.json({ popup: current })
		}

		if (url.pathname === "/set" && request.method === "POST") {
			const body = await request.json<any>()
			const payload = body?.popup
			if (!payload?.id) {
				return new Response("Missing popup payload", { status: 400 })
			}
			if (payload.schemaVersion !== 1) {
				return new Response("Unsupported schema version", { status: 400 })
			}
			const now = new Date().toISOString()
			const stored: StoredPopup = {
				...payload,
				enabled: payload.enabled !== false,
				updatedAt: now,
			}
			await this.storage.put(POPUP_CURRENT_KEY, stored)
			return Response.json({ ok: true })
		}

		if (url.pathname === "/clear" && request.method === "POST") {
			await this.storage.delete(POPUP_CURRENT_KEY)
			return Response.json({ ok: true })
		}

		if (url.pathname === "/has-seen" && request.method === "GET") {
			const popupId = url.searchParams.get("popupId")
			const viewerKey = url.searchParams.get("viewerKey")
			if (!popupId || !viewerKey) {
				return new Response("Missing popupId or viewerKey", { status: 400 })
			}
			const key = this.seenKey(popupId, viewerKey)
			const seen = Boolean(await this.storage.get<string>(key))
			return Response.json({ seen })
		}

		if (url.pathname === "/mark-seen" && request.method === "POST") {
			const body = await request.json<any>()
			const popupId = body?.popupId
			const viewerKey = body?.viewerKey
			if (!popupId || !viewerKey) {
				return new Response("Missing popupId or viewerKey", { status: 400 })
			}
			const key = this.seenKey(popupId, viewerKey)
			await this.storage.put(key, new Date().toISOString())
			return Response.json({ ok: true })
		}

		if (url.pathname === "/clear-seen" && request.method === "POST") {
			await this.clearSeenEntries()
			return Response.json({ ok: true })
		}

		return new Response("Not found", { status: 404 })
	}

	private seenKey(popupId: string, viewerKey: string) {
		return `${POPUP_SEEN_PREFIX}${popupId}:${viewerKey}`
	}

	private async clearSeenEntries() {
		const list = await this.storage.list<string>({ prefix: POPUP_SEEN_PREFIX })
		const keys = Array.from(list.keys())
		await Promise.all(keys.map((key) => this.storage.delete(key)))
	}
}

// The main Worker (the public API)
function isAdminSecretValid(provided: string | null | undefined, env: Env): boolean {
	if (!env.ADMIN_SECRET) return true
	return Boolean(provided && provided === env.ADMIN_SECRET)
}

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

		if (url.pathname === '/api/popup/current' && request.method === 'GET') {
			return handlePopupCurrent(request, env);
		}

		if (url.pathname === '/api/popup/seen' && request.method === 'POST') {
			return handlePopupSeen(request, env);
		}

		if (url.pathname === '/api/admin/popup/current' && request.method === 'GET') {
			return handleAdminPopupCurrent(request, env);
		}

		if (url.pathname === '/api/admin/popup/setCurrent' && request.method === 'POST') {
			return handleAdminPopupSetCurrent(request, env);
		}

		if (url.pathname === '/api/admin/popup/clearCurrent' && request.method === 'POST') {
			return handleAdminPopupClearCurrent(request, env);
		}

		if (url.pathname === '/api/track/open' && request.method === 'POST') {
			return handleTrackOpen(request, env);
		}

		return new Response('Not found', { status: 404 });
	},
};

// --- Handlers ---

async function handleRegister(request: Request, env: Env): Promise<Response> {
	const body = await request.json<any>();
	const providedSecret = body?.secret ?? request.headers.get('x-admin-secret');
	// Shared secret guards registration endpoints from anonymous callers.
	if (!isAdminSecretValid(providedSecret, env)) {
		return new Response('Unauthorized', { status: 401 });
	}

	const { token, email } = body;

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
	const body = await request.json<any>();
	const providedSecret = body?.secret ?? request.headers.get('x-admin-secret');
	// Shared secret guards unregistration from anonymous callers.
	if (!isAdminSecretValid(providedSecret, env)) {
		return new Response('Unauthorized', { status: 401 });
	}

	const { token } = body;
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

	if (!notificationId) {
		return new Response('Missing notification id', { status: 400 });
	}
	// Allow opens without a push token so broadcast-free notifications still record opens.
	const normalizedToken = typeof token === 'string' && token.length > 0 ? token : null;

	const statsId = env.PUSH_STATS_DO.idFromName('global');
	const statsStub = env.PUSH_STATS_DO.get(statsId);
	await statsStub.fetch('https://do/track-open', {
		method: 'POST',
		body: JSON.stringify({ id: notificationId, token: normalizedToken, email }),
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

function getPopupStub(env: Env): DurableObjectStub {
	const id = env.POPUP_DO.idFromName(POPUP_DO_NAME);
	return env.POPUP_DO.get(id);
}

async function handlePopupCurrent(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const viewerKey = (
		(url.searchParams.get('viewerKey') ?? request.headers.get('x-viewer-key') ?? '')
			.trim()
	);
	if (!viewerKey) {
		return new Response('Missing viewerKey', { status: 400 });
	}
	const appVersion =
		(url.searchParams.get('appVersion') ?? request.headers.get('x-app-version') ?? undefined)?.trim() ??
		undefined;

	const stub = getPopupStub(env);
	const popupRes = await stub.fetch('https://do/current');
	if (!popupRes.ok) {
		const text = await popupRes.text().catch(() => '');
		return new Response(text || 'Failed to load popup', { status: 500 });
	}
	const payload = await popupRes.json<{ popup: StoredPopup | null }>();
	const popup = payload?.popup ?? null;
	if (!popup || !popup.enabled) {
		return Response.json({ popup: null });
	}

	const now = Date.now();
	if (popup.startAt) {
		const start = Date.parse(popup.startAt);
		if (Number.isNaN(start) || now < start) {
			return Response.json({ popup: null });
		}
	}
	if (popup.endAt) {
		const end = Date.parse(popup.endAt);
		if (Number.isNaN(end) || now > end) {
			return Response.json({ popup: null });
		}
	}

	if (!meetsMinimumVersion(appVersion, popup.minAppVersion)) {
		return Response.json({ popup: null });
	}

	const viewerAudience = resolveViewerAudience(viewerKey);
	if (!isAudienceMatch(popup.audience, viewerAudience)) {
		return Response.json({ popup: null });
	}

	const seenRes = await stub.fetch(
		`https://do/has-seen?popupId=${encodeURIComponent(popup.id)}&viewerKey=${encodeURIComponent(
			viewerKey,
		)}`,
	);
	if (!seenRes.ok) {
		const text = await seenRes.text().catch(() => '');
		return new Response(text || 'Failed to verify seen state', { status: 500 });
	}
	const seenData = await seenRes.json<{ seen: boolean }>();
	if (seenData.seen) {
		return Response.json({ popup: null });
	}

	return Response.json({ popup });
}

async function handlePopupSeen(request: Request, env: Env): Promise<Response> {
	const body = await request.json<any>();
	const popupId = body?.popupId;
	const viewerKey = (body?.viewerKey ?? '').trim();
	if (!popupId || !viewerKey) {
		return new Response('Missing popupId or viewerKey', { status: 400 });
	}
	const stub = getPopupStub(env);
	const res = await stub.fetch('https://do/mark-seen', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ popupId, viewerKey }),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		return new Response(text || 'Failed to mark popup as seen', { status: 500 });
	}
	return Response.json({ ok: true });
}

async function handleAdminPopupCurrent(request: Request, env: Env): Promise<Response> {
	const secret = request.headers.get('x-admin-secret');
	if (!isAdminSecretValid(secret, env)) {
		return new Response('Unauthorized', { status: 401 });
	}
	const stub = getPopupStub(env);
	const res = await stub.fetch('https://do/current');
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		return new Response(text || 'Failed to load popup', { status: 500 });
	}
	const payload = await res.json<{ popup: StoredPopup | null }>();
	return Response.json(payload);
}

async function handleAdminPopupSetCurrent(request: Request, env: Env): Promise<Response> {
	const secret = request.headers.get('x-admin-secret');
	if (!isAdminSecretValid(secret, env)) {
		return new Response('Unauthorized', { status: 401 });
	}
	const payload = await request.json<any>();
	const body = payload?.popup ?? payload ?? {};
	const popupId = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : null;
	const title = typeof body?.title === 'string' ? body.title.trim() : '';
	const bodyText = typeof body?.body === 'string' ? body.body.trim() : '';
	if (!popupId || !title || !bodyText) {
		return new Response('Missing popup id, title, or body', { status: 400 });
	}

	const cta = body?.cta;
	if (cta && typeof cta.label !== 'string') {
		return new Response('CTA label must be a string', { status: 400 });
	}
	if (cta && typeof cta.value !== 'string') {
		return new Response('CTA value must be a string', { status: 400 });
	}
	if (cta && cta.action !== 'apply_coupon' && cta.action !== 'deeplink') {
		return new Response('CTA action must be apply_coupon or deeplink', { status: 400 });
	}

	const icon = body?.icon;
	if (icon && icon.type !== 'system' && icon.type !== 'image') {
		return new Response('Invalid icon type', { status: 400 });
	}

	const popup: PopupPayload = {
		schemaVersion: 1,
		id: popupId,
		enabled: body.enabled !== false,
		title,
		body: bodyText,
		icon: icon ? { type: icon.type, value: String(icon.value ?? '') } : undefined,
		cta: cta
			? {
					label: cta.label,
					action: cta.action,
					value: cta.value,
			  }
			: undefined,
		startAt: typeof body?.startAt === 'string' ? body.startAt : undefined,
		endAt: typeof body?.endAt === 'string' ? body.endAt : undefined,
		minAppVersion: typeof body?.minAppVersion === 'string' ? body.minAppVersion : undefined,
		audience: body?.audience,
	};

	const stub = getPopupStub(env);
	const setRes = await stub.fetch('https://do/set', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ popup }),
	});
	if (!setRes.ok) {
		const text = await setRes.text().catch(() => '');
		return new Response(text || 'Failed to set popup', { status: 500 });
	}
	const clearRes = await stub.fetch('https://do/clear-seen', {
		method: 'POST',
	});
	if (!clearRes.ok) {
		console.warn('Failed to clear popup seen cache');
	}
	return Response.json({ ok: true });
}

async function handleAdminPopupClearCurrent(request: Request, env: Env): Promise<Response> {
	const secret = request.headers.get('x-admin-secret');
	if (!isAdminSecretValid(secret, env)) {
		return new Response('Unauthorized', { status: 401 });
	}
	const stub = getPopupStub(env);
	const res = await stub.fetch('https://do/clear', {
		method: 'POST',
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		return new Response(text || 'Failed to clear popup', { status: 500 });
	}
	return Response.json({ ok: true });
}
