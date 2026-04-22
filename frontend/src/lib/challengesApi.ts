import type { ChallengeDetails, ChallengeSummary } from "../types/challenge";
import type {
    SandboxRunTestsRequest,
    SandboxRunTestsResponse,
    SubmitCodeRequest,
    SubmitCodeResponse,
} from "../types/sandbox";
import { fetchWithAuth } from "./authApi";

const API_BASE_URL = (
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""
).replace(/\/$/, "");

export function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }
    return fallback;
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(url, { signal });
    if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response));
    }

    return (await response.json()) as T;
}

async function getResponseErrorMessage(response: Response): Promise<string> {
    let errorMessage = `${response.status} ${response.statusText}`;
    try {
        const body = (await response.json()) as { message?: string };
        if (body.message) {
            errorMessage = body.message;
        }
    } catch {
        // Ignore JSON parsing failures and use status text.
    }
    return errorMessage;
}

export function fetchChallenges(signal: AbortSignal): Promise<ChallengeSummary[]> {
    return fetchJson<ChallengeSummary[]>(`${API_BASE_URL}/api/challenges`, signal);
}

export function fetchChallengeBySlug(slug: string, signal: AbortSignal): Promise<ChallengeDetails> {
    return fetchJson<ChallengeDetails>(`${API_BASE_URL}/api/challenges/${encodeURIComponent(slug)}`, signal);
}

export async function runChallengeTests(payload: SandboxRunTestsRequest): Promise<SandboxRunTestsResponse> {
    const response = await fetchWithAuth("/api/execution/run", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response));
    }

    return (await response.json()) as SandboxRunTestsResponse;
}

export async function submitChallengeCode(payload: SubmitCodeRequest): Promise<SubmitCodeResponse> {
    const response = await fetchWithAuth("/api/submissions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response));
    }

    return (await response.json()) as SubmitCodeResponse;
}
