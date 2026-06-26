export type AuthUser = {
	id: number;
	name: string;
	username: string | null;
	email: string | null;
	created_at: string;
	updated_at: string;
};

type SessionResponse = {
	user: AuthUser;
};

type LoginResponse = SessionResponse & {
	expires_at: string;
};

let currentUser: AuthUser | null = null;

const readErrorMessage = async (response: Response, fallback: string) => {
	const body = (await response.json().catch(() => null)) as { error?: string } | null;
	return body?.error ?? fallback;
};

export const getCurrentUser = () => currentUser;

export const setCurrentUser = (user: AuthUser | null) => {
	currentUser = user;
};

export const loadAuthSession = async () => {
	const response = await fetch("/api/auth/session", {
		credentials: "same-origin",
	});
	if (response.status === 401) {
		setCurrentUser(null);
		return null;
	}
	if (!response.ok) {
		throw new Error(await readErrorMessage(response, "Failed to load session"));
	}

	const body = (await response.json()) as SessionResponse;
	setCurrentUser(body.user);
	return body.user;
};

export const login = async (username: string, password: string) => {
	const response = await fetch("/api/auth/login", {
		method: "POST",
		credentials: "same-origin",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password }),
	});
	if (!response.ok) {
		throw new Error(await readErrorMessage(response, "Login failed"));
	}

	const body = (await response.json()) as LoginResponse;
	setCurrentUser(body.user);
	return body;
};

export const logout = async () => {
	const response = await fetch("/api/auth/logout", {
		method: "POST",
		credentials: "same-origin",
	});
	setCurrentUser(null);
	if (!response.ok) {
		throw new Error(await readErrorMessage(response, "Logout failed"));
	}
};
