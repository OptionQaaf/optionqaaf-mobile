export interface Env {
	PUSH_TOKENS_DO: DurableObjectNamespace;
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

	// Build Expo push objects
	const payloads = all.map((entry) => ({
		to: entry.token,
		sound: 'default',
		title,
		body: message,
		data: {
			kind: 'broadcast',
			...(path ? { path } : {}),
			...(url ? { url } : {}),
		},
	}));

	// Send to Expo push API
	await fetch('https://exp.host/--/api/v2/push/send', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payloads),
	});

	return new Response(`Sent to ${payloads.length} devices`, { status: 200 });
}
