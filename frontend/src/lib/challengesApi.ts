import type { ChallengeDetails, ChallengeSummary } from "../types/challenge";

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
        let errorMessage = `${response.status} ${response.statusText}`;
        try {
            const body = (await response.json()) as { message?: string };
            if (body.message) {
                errorMessage = body.message;
            }
        } catch {
            // Ignore JSON parsing failures and use status text.
        }
        throw new Error(errorMessage);
    }

    return (await response.json()) as T;
}

export function fetchChallenges(signal: AbortSignal): Promise<ChallengeSummary[]> {
    return fetchJson<ChallengeSummary[]>(`${API_BASE_URL}/api/challenges`, signal);
}

export function fetchChallengeBySlug(slug: string, signal: AbortSignal): Promise<ChallengeDetails> {
    return fetchJson<ChallengeDetails>(`${API_BASE_URL}/api/challenges/${encodeURIComponent(slug)}`, signal);
}
