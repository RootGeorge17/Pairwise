import type {
    ApiErrorResponse,
    AuthResponse,
    LoginRequest,
    MeResponse,
    RegisterRequest,
} from "../types/auth";

const API_BASE_URL = (
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""
).replace(/\/$/, "");

const STORAGE_KEYS = {
    accessToken: "pairwise.accessToken",
    refreshToken: "pairwise.refreshToken",
    userId: "pairwise.userId",
    username: "pairwise.username",
    email: "pairwise.email",
    displayName: "pairwise.displayName",
    role: "pairwise.role",
} as const;

export type StoredAuthSession = {
    accessToken: string;
    refreshToken: string | null;
    userId: number | null;
    username: string;
    email: string;
    displayName: string;
    role: string;
};

let refreshRequestInFlight: Promise<boolean> | null = null;

export class ApiRequestError extends Error {
    readonly status: number;
    readonly code: string | null;
    readonly fieldErrors: Record<string, string>;

    constructor(message: string, status: number, code: string | null, fieldErrors: Record<string, string>) {
        super(message);
        this.name = "ApiRequestError";
        this.status = status;
        this.code = code;
        this.fieldErrors = fieldErrors;
    }
}

function toFieldErrorsMap(error: ApiErrorResponse): Record<string, string> {
    const entries = (error.fieldErrors ?? [])
        .filter((fieldError) => fieldError.field.trim().length > 0)
        .map((fieldError) => [fieldError.field, fieldError.message] as const);

    return Object.fromEntries(entries);
}

async function parseErrorResponse(response: Response): Promise<ApiRequestError> {
    let body: ApiErrorResponse | null = null;

    try {
        body = (await response.json()) as ApiErrorResponse;
    } catch {
        body = null;
    }

    const fallbackMessage = `${response.status} ${response.statusText}`;
    const message = body?.message?.trim() || fallbackMessage;
    const code = body?.code?.trim() || null;
    const fieldErrors = body ? toFieldErrorsMap(body) : {};

    return new ApiRequestError(message, response.status, code, fieldErrors);
}

async function postJson<TRequest, TResponse>(path: string, payload: TRequest): Promise<TResponse> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw await parseErrorResponse(response);
    }

    return (await response.json()) as TResponse;
}

async function postJsonWithoutBody<TRequest>(path: string, payload: TRequest): Promise<void> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw await parseErrorResponse(response);
    }
}

function persistProfile(profile: MeResponse): void {
    localStorage.setItem(STORAGE_KEYS.userId, String(profile.userId));
    localStorage.setItem(STORAGE_KEYS.username, profile.username);
    localStorage.setItem(STORAGE_KEYS.email, profile.email);
    localStorage.setItem(STORAGE_KEYS.displayName, profile.displayName);
    localStorage.setItem(STORAGE_KEYS.role, profile.role);
}

async function requestRefreshToken(): Promise<boolean> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        return false;
    }

    try {
        const refreshedAuthSession = await postJson<{ refreshToken: string }, AuthResponse>(
            "/api/auth/refresh",
            { refreshToken }
        );
        persistAuthSession(refreshedAuthSession);
        return true;
    } catch {
        clearAuthSession();
        return false;
    }
}

async function refreshAccessTokenOnce(): Promise<boolean> {
    if (!refreshRequestInFlight) {
        refreshRequestInFlight = requestRefreshToken().finally(() => {
            refreshRequestInFlight = null;
        });
    }

    return refreshRequestInFlight;
}

function addAuthorizationHeader(headers: HeadersInit | undefined, accessToken: string): Headers {
    const resolvedHeaders = new Headers(headers);
    resolvedHeaders.set("Authorization", `Bearer ${accessToken}`);
    return resolvedHeaders;
}

export function login(payload: LoginRequest): Promise<AuthResponse> {
    return postJson<LoginRequest, AuthResponse>("/api/auth/login", payload);
}

export function register(payload: RegisterRequest): Promise<AuthResponse> {
    return postJson<RegisterRequest, AuthResponse>("/api/auth/register", payload);
}

export function persistAuthSession(authResponse: AuthResponse): void {
    localStorage.setItem(STORAGE_KEYS.accessToken, authResponse.accessToken);
    localStorage.setItem(STORAGE_KEYS.refreshToken, authResponse.refreshToken);
    localStorage.setItem(STORAGE_KEYS.userId, String(authResponse.userId));
    localStorage.setItem(STORAGE_KEYS.username, authResponse.username);
    localStorage.setItem(STORAGE_KEYS.email, authResponse.email);
    localStorage.setItem(STORAGE_KEYS.displayName, authResponse.displayName);
    localStorage.setItem(STORAGE_KEYS.role, authResponse.role);
}

export function clearAuthSession(): void {
    Object.values(STORAGE_KEYS).forEach((storageKey) => localStorage.removeItem(storageKey));
}

export function getAccessToken(): string | null {
    return getStoredAuthSession()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
    return getStoredAuthSession()?.refreshToken ?? null;
}

export function getStoredAuthSession(): StoredAuthSession | null {
    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken)?.trim() ?? "";
    if (accessToken.length === 0) {
        return null;
    }

    const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken)?.trim() ?? "";

    const rawUserId = localStorage.getItem(STORAGE_KEYS.userId);
    const parsedUserId = rawUserId !== null ? Number(rawUserId) : NaN;
    const userId = Number.isFinite(parsedUserId) ? parsedUserId : null;

    return {
        accessToken,
        refreshToken: refreshToken.length > 0 ? refreshToken : null,
        userId,
        username: localStorage.getItem(STORAGE_KEYS.username) ?? "",
        email: localStorage.getItem(STORAGE_KEYS.email) ?? "",
        displayName: localStorage.getItem(STORAGE_KEYS.displayName) ?? "",
        role: localStorage.getItem(STORAGE_KEYS.role) ?? "",
    };
}

export async function fetchWithAuth(path: string, init: RequestInit = {}): Promise<Response> {
    const session = getStoredAuthSession();
    if (!session?.accessToken) {
        throw new Error("You must sign in before accessing this resource.");
    }

    const firstResponse = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: addAuthorizationHeader(init.headers, session.accessToken),
    });

    if (firstResponse.status !== 401) {
        return firstResponse;
    }

    const wasRefreshed = await refreshAccessTokenOnce();
    if (!wasRefreshed) {
        return firstResponse;
    }

    const updatedSession = getStoredAuthSession();
    if (!updatedSession?.accessToken) {
        return firstResponse;
    }

    return fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: addAuthorizationHeader(init.headers, updatedSession.accessToken),
    });
}

export async function fetchCurrentUser(): Promise<MeResponse> {
    const response = await fetchWithAuth("/api/auth/me");
    if (!response.ok) {
        throw await parseErrorResponse(response);
    }

    return (await response.json()) as MeResponse;
}

export async function bootstrapAuthSession(): Promise<StoredAuthSession | null> {
    const session = getStoredAuthSession();
    if (!session) {
        return null;
    }

    try {
        const currentUser = await fetchCurrentUser();
        persistProfile(currentUser);
        return getStoredAuthSession();
    } catch {
        clearAuthSession();
        return null;
    }
}

export async function logoutFromServer(): Promise<void> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        return;
    }

    await postJsonWithoutBody<{ refreshToken: string }>("/api/auth/logout", { refreshToken });
}
