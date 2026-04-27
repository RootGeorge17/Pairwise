import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, RefObject } from "react";
import {
    ArrowLeft,
    CirclePlay,
    ClipboardList,
    KeyRound,
    LoaderCircle,
    LogOut,
    PlusCircle,
    Users,
    Users2,
} from "lucide-react";
import MonacoEditor, { type MonacoExtraTab } from "./components/MonacoEditor.tsx";
import type { LobbyCursorPresence } from "./hooks/useLobbyCollaboration";
import ChallengePanel from "./components/ChallengePanel.tsx";
import ChallengesPage from "./components/ChallengesPage.tsx";
import LoginPage from "./components/LoginPage.tsx";
import RegisterPage from "./components/RegisterPage.tsx";
import AppNavbar from "./components/AppNavbar.tsx";
import {
    createLobby,
    fetchChallengeBySlug,
    fetchChallenges,
    fetchLobbies,
    fetchLobbyById,
    getErrorMessage,
    joinLobby,
    leaveLobby,
    rotateLobbyRoles,
    startLobby,
    stopLobby,
    transferLobbyHost,
    updateLobbyParticipantRole,
    updateLobbySettings,
} from "./lib/challengesApi";
import {
    bootstrapAuthSession,
    clearAuthSession,
    getStoredAuthSession,
    logoutFromServer,
} from "./lib/authApi";
import type {
    ChallengeDetails,
    ChallengeSummary,
    LobbyParticipant,
    LobbyResponse,
    UpdateLobbySettingsRequest,
} from "./types/challenge";

function normalizePathname(pathname: string): string {
    if (pathname === "/") {
        return pathname;
    }
    return pathname.replace(/\/+$/, "");
}

function getChallengeSlug(pathname: string): string | null {
    const match = pathname.match(/^\/challenges\/([^/]+)$/);
    if (!match) {
        return null;
    }
    return decodeURIComponent(match[1]);
}

function getLobbyId(pathname: string): number | null {
    const match = pathname.match(/^\/lobbies\/(\d+)$/);
    if (!match) {
        return null;
    }

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatDifficulty(difficulty: string): string {
    return difficulty.charAt(0) + difficulty.slice(1).toLowerCase();
}

function formatLanguageLabel(language: string): string {
    switch (language.toUpperCase()) {
        case "JAVASCRIPT":
            return "JavaScript";
        case "PYTHON":
            return "Python";
        default:
            return language;
    }
}

function formatDateTime(value: string | null): string {
    if (!value) {
        return "-";
    }

    return new Date(value).toLocaleString();
}

const REMOTE_CURSOR_COLOR_VARIANTS_COUNT = 6;

function getRemoteCursorColorIndex(userId: number): number {
    return Math.abs(userId) % REMOTE_CURSOR_COLOR_VARIANTS_COUNT;
}

function formatCountdown(seconds: number): string {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainderSeconds = safeSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainderSeconds.toString().padStart(2, "0")}`;
}

function getDifficultyClasses(difficulty: string): string {
    switch (difficulty.toUpperCase()) {
        case "EASY":
            return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
        case "MEDIUM":
            return "border-amber-500/40 bg-amber-500/10 text-amber-300";
        case "HARD":
            return "border-rose-500/40 bg-rose-500/10 text-rose-300";
        default:
            return "border-slate-600 bg-slate-700/20 text-slate-300";
    }
}

function getLobbyStatusClasses(status: string): string {
    switch (status.toUpperCase()) {
        case "WAITING":
            return "border-sky-500/40 bg-sky-500/10 text-sky-300";
        case "ACTIVE":
            return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
        case "CLOSED":
            return "border-slate-600 bg-slate-700/20 text-slate-300";
        default:
            return "border-slate-600 bg-slate-700/20 text-slate-300";
    }
}

type WorkspaceLayoutProps = {
    challengePanel: ReactElement;
    editorPanel: ReactElement;
    isNarrowViewport: boolean;
    splitContainerRef: RefObject<HTMLDivElement | null>;
    leftPanelWidthPercent: number;
    isResizingPanels: boolean;
    setLeftPanelWidthPercent: (value: number) => void;
    setIsResizingPanels: (value: boolean) => void;
};

function WorkspaceLayout({
    challengePanel,
    editorPanel,
    isNarrowViewport,
    splitContainerRef,
    leftPanelWidthPercent,
    isResizingPanels,
    setLeftPanelWidthPercent,
    setIsResizingPanels,
}: WorkspaceLayoutProps) {
    return (
        <div className="h-full w-full overflow-hidden p-2">
            {isNarrowViewport ? (
                <div className="flex h-full min-h-0 flex-col gap-2">
                    <div className="min-h-0 flex-[1.05]">{challengePanel}</div>
                    <div className="min-h-0 flex-1">{editorPanel}</div>
                </div>
            ) : (
                <div ref={splitContainerRef} className="flex h-full min-h-0 w-full items-stretch gap-2">
                    <div
                        className="h-full min-h-0 min-w-0"
                        style={{ width: `${leftPanelWidthPercent}%` }}
                    >
                        {challengePanel}
                    </div>

                    <button
                        type="button"
                        aria-label="Resize panels"
                        aria-orientation="vertical"
                        onMouseDown={(event) => {
                            event.preventDefault();
                            setIsResizingPanels(true);
                        }}
                        onDoubleClick={() => setLeftPanelWidthPercent(50)}
                        className={`group relative h-full w-3 shrink-0 cursor-col-resize rounded-full border border-slate-700/60 bg-slate-900/70 transition ${
                            isResizingPanels ? "border-sky-500/80 bg-sky-500/20" : "hover:border-slate-500/80"
                        }`}
                    >
                        <span className="absolute left-1/2 top-1/2 h-16 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500 transition group-hover:bg-slate-300" />
                    </button>

                    <div className="h-full min-h-0 min-w-0 flex-1">{editorPanel}</div>
                </div>
            )}
        </div>
    );
}

type LobbiesPageProps = {
    onOpenLobby: (lobbyId: number) => void;
};

function LobbiesPage({ onOpenLobby }: LobbiesPageProps) {
    const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
    const [lobbies, setLobbies] = useState<LobbyResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshingLobbies, setIsRefreshingLobbies] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(null);
    const [challengeDetails, setChallengeDetails] = useState<ChallengeDetails | null>(null);
    const [selectedLanguageId, setSelectedLanguageId] = useState<number | null>(null);
    const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
    const [lobbyName, setLobbyName] = useState("");
    const [createRoleRotationEnabled, setCreateRoleRotationEnabled] = useState(true);
    const [createRotationIntervalMinutes, setCreateRotationIntervalMinutes] = useState<number>(10);
    const [joinCode, setJoinCode] = useState("");

    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);
    const [joinErrorMessage, setJoinErrorMessage] = useState<string | null>(null);

    const refreshLobbies = async (background = false): Promise<void> => {
        if (background) {
            setIsRefreshingLobbies(true);
        }

        try {
            const loadedLobbies = await fetchLobbies();
            setLobbies(loadedLobbies);
        } catch (error) {
            if (!background) {
                setErrorMessage(getErrorMessage(error, "Failed to load lobbies."));
            }
        } finally {
            if (background) {
                setIsRefreshingLobbies(false);
            }
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;

        const loadPage = async () => {
            setIsLoading(true);
            setErrorMessage(null);

            try {
                const [loadedChallenges, loadedLobbies] = await Promise.all([
                    fetchChallenges(controller.signal),
                    fetchLobbies(),
                ]);

                if (cancelled || controller.signal.aborted) {
                    return;
                }

                setChallenges(loadedChallenges);
                setLobbies(loadedLobbies);
                if (loadedChallenges.length > 0) {
                    setSelectedChallengeId(loadedChallenges[0].id);
                }
            } catch (error) {
                if (cancelled || controller.signal.aborted) {
                    return;
                }
                setChallenges([]);
                setLobbies([]);
                setErrorMessage(getErrorMessage(error, "Failed to load lobby data."));
            } finally {
                if (!cancelled && !controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        void loadPage();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, []);

    useEffect(() => {
        if (!selectedChallengeId) {
            setChallengeDetails(null);
            setSelectedLanguageId(null);
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        const loadChallengeDetails = async () => {
            setIsLoadingLanguages(true);
            setCreateErrorMessage(null);

            try {
                const selectedChallenge = challenges.find((challenge) => challenge.id === selectedChallengeId);
                if (!selectedChallenge) {
                    setChallengeDetails(null);
                    setSelectedLanguageId(null);
                    return;
                }

                const details = await fetchChallengeBySlug(selectedChallenge.slug, controller.signal);
                if (cancelled || controller.signal.aborted) {
                    return;
                }

                setChallengeDetails(details);
                const defaultLanguage = details.languages.find((language) => language.isDefault) ?? details.languages[0] ?? null;
                setSelectedLanguageId(defaultLanguage ? defaultLanguage.id : null);
            } catch (error) {
                if (cancelled || controller.signal.aborted) {
                    return;
                }
                setChallengeDetails(null);
                setSelectedLanguageId(null);
                setCreateErrorMessage(getErrorMessage(error, "Failed to load challenge languages."));
            } finally {
                if (!cancelled && !controller.signal.aborted) {
                    setIsLoadingLanguages(false);
                }
            }
        };

        void loadChallengeDetails();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [challenges, selectedChallengeId]);

    const handleCreateLobby = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!selectedChallengeId || !selectedLanguageId) {
            setCreateErrorMessage("Select a challenge and language before creating a lobby.");
            return;
        }

        setIsCreating(true);
        setCreateErrorMessage(null);

        const trimmedName = lobbyName.trim();
        const payload = {
            challengeId: selectedChallengeId,
            challengeLanguageId: selectedLanguageId,
            roleRotationEnabled: createRoleRotationEnabled,
            rotationIntervalSecs: createRoleRotationEnabled
                ? Math.max(1, Math.round(createRotationIntervalMinutes * 60))
                : undefined,
            ...(trimmedName.length > 0 ? { name: trimmedName } : {}),
        };

        try {
            const lobby = await createLobby(payload);
            onOpenLobby(lobby.id);
        } catch (error) {
            setCreateErrorMessage(getErrorMessage(error, "Failed to create lobby."));
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinLobby = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const normalizedJoinCode = joinCode.trim().toUpperCase();
        if (!normalizedJoinCode) {
            setJoinErrorMessage("Enter a join code.");
            return;
        }

        setIsJoining(true);
        setJoinErrorMessage(null);

        try {
            const lobby = await joinLobby({ joinCode: normalizedJoinCode });
            onOpenLobby(lobby.id);
        } catch (error) {
            setJoinErrorMessage(getErrorMessage(error, "Failed to join lobby."));
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <div className="h-full bg-gray-900 p-6 text-white">
            <div className="mx-auto max-w-6xl space-y-6">
                <header className="border-b border-slate-700 pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold">Lobbies</h1>
                            <p className="mt-1 text-sm text-slate-400">
                                Create pair-programming sessions, join by code, and jump back into active collaboration.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void refreshLobbies(true)}
                            disabled={isRefreshingLobbies}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
                        >
                            <LoaderCircle className={`h-4 w-4 ${isRefreshingLobbies ? "animate-spin" : ""}`} />
                            Refresh
                        </button>
                    </div>
                </header>

                {isLoading && <p className="text-slate-300">Loading lobby workspace...</p>}

                {errorMessage && (
                    <p className="rounded-md border border-rose-500/50 bg-rose-500/10 p-3 text-rose-300">
                        {errorMessage}
                    </p>
                )}

                {!isLoading && !errorMessage && (
                    <>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <section className="rounded-xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.35)]">
                                <div className="mb-4 flex items-center gap-2">
                                    <PlusCircle className="h-5 w-5 text-sky-300" />
                                    <h2 className="text-lg font-semibold text-slate-100">Create Lobby</h2>
                                </div>

                                <form className="space-y-3" onSubmit={(event) => void handleCreateLobby(event)}>
                                    <label className="block space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Challenge</span>
                                        <select
                                            value={selectedChallengeId ?? ""}
                                            onChange={(event) => setSelectedChallengeId(Number(event.target.value))}
                                            className="w-full rounded-lg border border-slate-600 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
                                            disabled={challenges.length === 0}
                                        >
                                            {challenges.length === 0 && <option value="">No challenges available</option>}
                                            {challenges.map((challenge) => (
                                                <option key={challenge.id} value={challenge.id}>
                                                    {challenge.title}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="block space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Language</span>
                                        <select
                                            value={selectedLanguageId ?? ""}
                                            onChange={(event) => setSelectedLanguageId(Number(event.target.value))}
                                            className="w-full rounded-lg border border-slate-600 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
                                            disabled={isLoadingLanguages || !challengeDetails}
                                        >
                                            {!challengeDetails && <option value="">Select challenge first</option>}
                                            {challengeDetails?.languages.map((language) => (
                                                <option key={language.id} value={language.id}>
                                                    {formatLanguageLabel(language.language)}
                                                    {language.isDefault ? " (Default)" : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="block space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lobby Name (Optional)</span>
                                        <input
                                            type="text"
                                            value={lobbyName}
                                            onChange={(event) => setLobbyName(event.target.value)}
                                            maxLength={80}
                                            placeholder=""
                                            className="w-full rounded-lg border border-slate-600 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                                        />
                                    </label>

                                    <label className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                                        <input
                                            type="checkbox"
                                            checked={createRoleRotationEnabled}
                                            onChange={(event) => {
                                                const nextEnabled = event.target.checked;
                                                setCreateRoleRotationEnabled(nextEnabled);
                                                if (!nextEnabled) {
                                                    setCreateRotationIntervalMinutes(0);
                                                } else if (createRotationIntervalMinutes <= 0) {
                                                    setCreateRotationIntervalMinutes(10);
                                                }
                                            }}
                                            className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-400 focus:ring-sky-400"
                                        />
                                        <span className="text-sm text-slate-200">Role rotation on</span>
                                    </label>

                                    <label className="block space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                            Rotation Interval (Minutes)
                                        </span>
                                        <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={createRotationIntervalMinutes}
                                            onChange={(event) => {
                                                const nextValue = Number(event.target.value);
                                                if (!Number.isFinite(nextValue)) {
                                                    setCreateRotationIntervalMinutes(createRoleRotationEnabled ? 1 : 0);
                                                    return;
                                                }
                                                setCreateRotationIntervalMinutes(
                                                    createRoleRotationEnabled ? Math.max(1, nextValue) : Math.max(0, nextValue),
                                                );
                                            }}
                                            disabled={!createRoleRotationEnabled}
                                            className="w-full rounded-lg border border-slate-600 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
                                        />
                                    </label>

                                    {createErrorMessage && (
                                        <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                                            {createErrorMessage}
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isCreating || !selectedChallengeId || !selectedLanguageId}
                                        className="inline-flex items-center gap-2 rounded-lg border border-sky-300/60 bg-sky-400/20 px-4 py-2 text-sm font-semibold text-sky-50 transition hover:bg-sky-400/30 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                        <PlusCircle className="h-4 w-4" />
                                        {isCreating ? "Creating..." : "Create lobby"}
                                    </button>
                                </form>
                            </section>

                            <section className="rounded-xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-[0_10px_28px_rgba(2,6,23,0.35)]">
                                <div className="mb-4 flex items-center gap-2">
                                    <KeyRound className="h-5 w-5 text-emerald-300" />
                                    <h2 className="text-lg font-semibold text-slate-100">Join by Code</h2>
                                </div>

                                <form className="space-y-3" onSubmit={(event) => void handleJoinLobby(event)}>
                                    <label className="block space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Join Code</span>
                                        <input
                                            type="text"
                                            value={joinCode}
                                            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                                            maxLength={8}
                                            placeholder=""
                                            className="w-full rounded-lg border border-slate-600 bg-slate-950/80 px-3 py-2 text-sm tracking-[0.18em] text-slate-100 uppercase placeholder:tracking-normal placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                                        />
                                    </label>

                                    {joinErrorMessage && (
                                        <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                                            {joinErrorMessage}
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isJoining}
                                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/60 bg-emerald-400/20 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                        <Users className="h-4 w-4" />
                                        {isJoining ? "Joining..." : "Join lobby"}
                                    </button>
                                </form>
                            </section>
                        </div>

                        <section className="space-y-3">
                            <div className="flex items-center gap-2">
                                <ClipboardList className="h-5 w-5 text-slate-300" />
                                <h2 className="text-lg font-semibold text-slate-100">Your Lobbies</h2>
                            </div>

                            {lobbies.length === 0 ? (
                                <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-5 text-sm text-slate-300">
                                    You are not currently in any active lobby.
                                </div>
                            ) : (
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {lobbies.map((lobby) => (
                                        <article
                                            key={lobby.id}
                                            className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_8px_24px_rgba(2,6,23,0.35)]"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="mt-1 line-clamp-2 text-base font-semibold text-slate-100">
                                                        {lobby.name?.trim().length ? lobby.name : lobby.challenge.title}
                                                    </h3>
                                                </div>
                                                <span
                                                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getLobbyStatusClasses(lobby.status)}`}
                                                >
                                                    {lobby.status}
                                                </span>
                                            </div>

                                            <p className="mt-2 text-sm text-slate-300">{lobby.challenge.title}</p>

                                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                                <span className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1">
                                                    Code: {lobby.joinCode}
                                                </span>
                                                <span className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1">
                                                    {formatLanguageLabel(lobby.language.language)}
                                                </span>
                                                <span
                                                    className={`rounded-md border px-2 py-1 ${getDifficultyClasses(lobby.challenge.difficulty)}`}
                                                >
                                                    {formatDifficulty(lobby.challenge.difficulty)}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                                                <span>{lobby.participants.length}/{lobby.maxParticipants} participants</span>
                                                <span>Role: {lobby.currentUserRole ?? "-"}</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => onOpenLobby(lobby.id)}
                                                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-950/70 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:border-slate-400"
                                            >
                                                Open lobby
                                            </button>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}

function LobbyDetailsPanel({
    lobby,
    currentUserId,
    isUpdatingSettings,
    hostSettingsDisabled,
    onUpdateSettings,
}: {
    lobby: LobbyResponse;
    currentUserId: number | null;
    isUpdatingSettings: boolean;
    hostSettingsDisabled: boolean;
    onUpdateSettings: (payload: UpdateLobbySettingsRequest) => Promise<void>;
}) {
    const hostParticipant = lobby.participants.find((participant) => participant.userId === lobby.hostUserId);
    const hostName = hostParticipant
        ? (hostParticipant.displayName?.trim().length ? hostParticipant.displayName : hostParticipant.username)
        : `User #${lobby.hostUserId}`;
    const isHost = currentUserId !== null && currentUserId === lobby.hostUserId;
    const [roleRotationEnabled, setRoleRotationEnabled] = useState(lobby.roleRotationEnabled);
    const [rotationIntervalMinutes, setRotationIntervalMinutes] = useState(
        Math.max(1, Math.round((lobby.rotationIntervalSecs ?? 600) / 60)),
    );

    useEffect(() => {
        setRoleRotationEnabled(lobby.roleRotationEnabled);
        setRotationIntervalMinutes(Math.max(1, Math.round((lobby.rotationIntervalSecs ?? 600) / 60)));
    }, [lobby.roleRotationEnabled, lobby.rotationIntervalSecs]);

    const handleSaveSettings = async () => {
        await onUpdateSettings({
            roleRotationEnabled,
            rotationIntervalSecs: roleRotationEnabled
                ? Math.max(1, Math.round(rotationIntervalMinutes * 60))
                : undefined,
        });
    };

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Lobby Overview</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-100">
                    {lobby.name?.trim().length ? lobby.name : `Lobby ${lobby.joinCode}`}
                </h3>
                <p className="mt-1 text-sm text-slate-300">Challenge: {lobby.challenge.title}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Join Code</p>
                    <p className="mt-1 text-xl font-semibold tracking-[0.2em] text-sky-200">{lobby.joinCode}</p>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Status</p>
                    <p className="mt-1 text-xl font-semibold text-slate-100">{lobby.status}</p>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Language</p>
                    <p className="mt-1 text-xl font-semibold text-slate-100">{formatLanguageLabel(lobby.language.language)}</p>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Host Name</p>
                    <p className="mt-1 text-xl font-medium text-slate-200">{hostName}</p>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Role Rotation</p>
                    <p className="mt-1 text-xl font-semibold text-slate-100">{lobby.roleRotationEnabled ? "On" : "Off"}</p>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Max Participants</p>
                    <p className="mt-1 text-xl font-semibold text-slate-100">{lobby.maxParticipants}</p>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Rotation Interval (seconds)</p>
                    <p className="mt-1 text-xl font-semibold text-slate-100">{lobby.rotationIntervalSecs ?? "-"}</p>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Last role switch</p>
                    <p className="mt-1 text-sm font-medium text-slate-200">{formatDateTime(lobby.lastRoleSwitchAt)}</p>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Created</p>
                    <p className="mt-1 text-sm font-medium text-slate-200">{formatDateTime(lobby.createdAt)}</p>
                </div>
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Started</p>
                    <p className="mt-1 text-sm font-medium text-slate-200">{formatDateTime(lobby.startedAt)}</p>
                </div>
            </div>

            {isHost && (
                <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Host Settings</p>
                    <div className="mt-3 space-y-3">
                        <label className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                            <input
                                type="checkbox"
                                checked={roleRotationEnabled}
                                onChange={(event) => {
                                    const nextEnabled = event.target.checked;
                                    setRoleRotationEnabled(nextEnabled);
                                    if (!nextEnabled) {
                                        setRotationIntervalMinutes(0);
                                    } else if (rotationIntervalMinutes <= 0) {
                                        setRotationIntervalMinutes(10);
                                    }
                                }}
                                disabled={hostSettingsDisabled || isUpdatingSettings}
                                className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-400 focus:ring-sky-400"
                            />
                            <span className="text-sm text-slate-200">Role rotation on</span>
                        </label>

                        <label className="block space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Rotation Interval (Minutes)
                            </span>
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={rotationIntervalMinutes}
                                onChange={(event) => {
                                    const nextValue = Number(event.target.value);
                                    if (!Number.isFinite(nextValue)) {
                                        setRotationIntervalMinutes(roleRotationEnabled ? 1 : 0);
                                        return;
                                    }
                                    setRotationIntervalMinutes(
                                        roleRotationEnabled ? Math.max(1, nextValue) : Math.max(0, nextValue),
                                    );
                                }}
                                disabled={!roleRotationEnabled || hostSettingsDisabled || isUpdatingSettings}
                                className="w-full rounded-lg border border-slate-600 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
                            />
                        </label>

                        <button
                            type="button"
                            onClick={() => void handleSaveSettings()}
                            disabled={isUpdatingSettings || hostSettingsDisabled}
                            className="inline-flex items-center gap-2 rounded-lg border border-sky-300/60 bg-sky-400/20 px-4 py-2 text-sm font-semibold text-sky-50 transition hover:bg-sky-400/30 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isUpdatingSettings ? "Saving..." : "Save settings"}
                        </button>
                        {hostSettingsDisabled && (
                            <p className="text-xs text-slate-400">
                                Host settings are locked after lobby start.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function RoleBadge({ role }: { role: string }) {
    const normalizedRole = role.toUpperCase();
    const roleClassName = normalizedRole === "DRIVER"
        ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
        : normalizedRole === "NAVIGATOR"
            ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
            : "border-slate-600 bg-slate-700/20 text-slate-300";

    return (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${roleClassName}`}>
            {normalizedRole}
        </span>
    );
}

function LobbyParticipantsPanel({
    participants,
    hostUserId,
    currentDriverUserId,
    currentUserId,
    cursorPresenceByUserId,
    currentFilename,
    isHost,
    hostActionsDisabled,
    activeParticipantActionUserId,
    onUpdateRole,
    onTransferHost,
}: {
    participants: LobbyParticipant[];
    hostUserId: number;
    currentDriverUserId: number | null;
    currentUserId: number | null;
    cursorPresenceByUserId: Record<number, LobbyCursorPresence>;
    currentFilename: string;
    isHost: boolean;
    hostActionsDisabled: boolean;
    activeParticipantActionUserId: number | null;
    onUpdateRole: (userId: number, pairRole: string) => Promise<void>;
    onTransferHost: (userId: number) => Promise<void>;
}) {
    const hostParticipant = participants.find((participant) => participant.userId === hostUserId);
    const hostRole = hostParticipant?.pairRole ?? null;
    const canMakeHostRoleButton = hostRole !== null && hostRole !== "OBSERVER";

    return (
        <div className="space-y-3">
            {participants.map((participant) => {
                const displayName = participant.displayName?.trim().length
                    ? participant.displayName
                    : participant.username;
                const colorIndex = getRemoteCursorColorIndex(participant.userId);
                const presence = cursorPresenceByUserId[participant.userId];
                const isRowBusy = activeParticipantActionUserId === participant.userId;
                const canTransferHost = isHost && participant.userId !== hostUserId;
                const canManageRoles = isHost && !hostActionsDisabled && participant.userId !== hostUserId;

                return (
                    <article
                        key={participant.userId}
                        className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold text-slate-100">{displayName}</p>
                                <p className="text-xs text-slate-400">@{participant.username}</p>
                            </div>
                            <RoleBadge role={participant.pairRole} />
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                            {participant.userId === hostUserId && (
                                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                                    Host
                                </span>
                            )}
                            {currentDriverUserId !== null && participant.userId === currentDriverUserId && (
                                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
                                    Current Driver
                                </span>
                            )}
                            {currentUserId !== null && participant.userId === currentUserId && (
                                <span className="rounded-full border border-slate-500/60 bg-slate-800/80 px-2 py-0.5 text-slate-200">
                                    You
                                </span>
                            )}
                            <span className="text-slate-400">Joined {formatDateTime(participant.joinedAt)}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                            <span className={`h-2.5 w-2.5 rounded-full lobby-presence-dot-${colorIndex}`} />
                            <span className="text-slate-200">{displayName}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400">
                                {presence ? `${currentFilename}:${presence.line}` : "No active cursor"}
                            </span>
                        </div>

                        {canManageRoles && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                {canMakeHostRoleButton && hostRole !== null && (
                                    <button
                                        type="button"
                                        onClick={() => void onUpdateRole(participant.userId, hostRole)}
                                        disabled={isRowBusy || participant.pairRole === hostRole}
                                        className="rounded-md border border-sky-300/60 bg-sky-400/20 px-2.5 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isRowBusy ? "Saving..." : `Make ${hostRole}`}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => void onUpdateRole(participant.userId, "OBSERVER")}
                                    disabled={isRowBusy || participant.pairRole === "OBSERVER"}
                                    className="rounded-md border border-violet-300/60 bg-violet-400/20 px-2.5 py-1 text-xs font-semibold text-violet-100 transition hover:bg-violet-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isRowBusy ? "Saving..." : "Make Observer"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void onTransferHost(participant.userId)}
                                    disabled={isRowBusy || !canTransferHost}
                                    className="rounded-md border border-amber-300/60 bg-amber-400/20 px-2.5 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isRowBusy ? "Saving..." : "Make Host"}
                                </button>
                            </div>
                        )}
                    </article>
                );
            })}
        </div>
    );
}

type LobbyWorkspacePageProps = {
    lobbyId: number;
    currentUserId: number | null;
    onBack: () => void;
    isNarrowViewport: boolean;
    splitContainerRef: RefObject<HTMLDivElement | null>;
    leftPanelWidthPercent: number;
    isResizingPanels: boolean;
    setLeftPanelWidthPercent: (value: number) => void;
    setIsResizingPanels: (value: boolean) => void;
};

function LobbyWorkspacePage({
    lobbyId,
    currentUserId,
    onBack,
    isNarrowViewport,
    splitContainerRef,
    leftPanelWidthPercent,
    isResizingPanels,
    setLeftPanelWidthPercent,
    setIsResizingPanels,
}: LobbyWorkspacePageProps) {
    const [lobby, setLobby] = useState<LobbyResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
    const [activeParticipantActionUserId, setActiveParticipantActionUserId] = useState<number | null>(null);
    const [isAutoRotatingRoles, setIsAutoRotatingRoles] = useState(false);
    const [cursorPresenceByUserId, setCursorPresenceByUserId] = useState<Record<number, LobbyCursorPresence>>({});
    const [nowTimestampMs, setNowTimestampMs] = useState(() => Date.now());

    useEffect(() => {
        let cancelled = false;

        const loadLobby = async (background = false) => {
            if (!background) {
                setIsLoading(true);
            }

            try {
                const loadedLobby = await fetchLobbyById(lobbyId);
                if (cancelled) {
                    return;
                }

                setLobby(loadedLobby);
                setErrorMessage(null);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                if (!background) {
                    setLobby(null);
                }
                setErrorMessage(getErrorMessage(error, "Failed to load lobby."));
            } finally {
                if (!cancelled && !background) {
                    setIsLoading(false);
                }
            }
        };

        void loadLobby(false);
        const intervalId = window.setInterval(() => {
            void loadLobby(true);
        }, 10000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [lobbyId]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setNowTimestampMs(Date.now());
        }, 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    useEffect(() => {
        if (!lobby) {
            return;
        }

        const activeParticipantIds = new Set(lobby.participants.map((participant) => participant.userId));
        setCursorPresenceByUserId((current) => {
            const next: Record<number, LobbyCursorPresence> = {};
            let changed = false;

            Object.entries(current).forEach(([key, presence]) => {
                const userId = Number(key);
                if (activeParticipantIds.has(userId)) {
                    next[userId] = presence;
                } else {
                    changed = true;
                }
            });

            if (!changed && Object.keys(next).length === Object.keys(current).length) {
                return current;
            }
            return next;
        });
    }, [lobby]);

    const handleStart = async (): Promise<void> => {
        if (!lobby || isStarting) {
            return;
        }

        setIsStarting(true);
        try {
            const updatedLobby = await startLobby(lobby.id);
            setLobby(updatedLobby);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(getErrorMessage(error, "Failed to start lobby."));
        } finally {
            setIsStarting(false);
        }
    };

    const handleLeave = async (): Promise<void> => {
        if (!lobby || isLeaving) {
            return;
        }

        setIsLeaving(true);
        try {
            await leaveLobby(lobby.id);
            onBack();
        } catch (error) {
            setErrorMessage(getErrorMessage(error, "Failed to leave lobby."));
            setIsLeaving(false);
        }
    };

    const handleStop = async (): Promise<void> => {
        if (!lobby || isStopping) {
            return;
        }

        setIsStopping(true);
        try {
            const updatedLobby = await stopLobby(lobby.id);
            setLobby(updatedLobby);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(getErrorMessage(error, "Failed to stop lobby."));
        } finally {
            setIsStopping(false);
        }
    };

    const handleUpdateLobbySettings = async (payload: UpdateLobbySettingsRequest): Promise<void> => {
        if (!lobby || isUpdatingSettings) {
            return;
        }

        setIsUpdatingSettings(true);
        try {
            const updatedLobby = await updateLobbySettings(lobby.id, payload);
            setLobby(updatedLobby);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(getErrorMessage(error, "Failed to update lobby settings."));
        } finally {
            setIsUpdatingSettings(false);
        }
    };

    const handleUpdateParticipantRole = async (userId: number, pairRole: string): Promise<void> => {
        if (!lobby || activeParticipantActionUserId !== null) {
            return;
        }

        setActiveParticipantActionUserId(userId);
        try {
            const updatedLobby = await updateLobbyParticipantRole(lobby.id, userId, pairRole);
            setLobby(updatedLobby);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(getErrorMessage(error, "Failed to update participant role."));
        } finally {
            setActiveParticipantActionUserId(null);
        }
    };

    const handleTransferHost = async (userId: number): Promise<void> => {
        if (!lobby || activeParticipantActionUserId !== null) {
            return;
        }

        setActiveParticipantActionUserId(userId);
        try {
            const updatedLobby = await transferLobbyHost(lobby.id, userId);
            setLobby(updatedLobby);
            setErrorMessage(null);
        } catch (error) {
            setErrorMessage(getErrorMessage(error, "Failed to transfer host."));
        } finally {
            setActiveParticipantActionUserId(null);
        }
    };

    const lobbyStatus = lobby?.status.toUpperCase() ?? "";
    const rotationRemainingSeconds = useMemo(() => {
        if (
            lobby == null
            || lobbyStatus !== "ACTIVE"
            || !lobby.roleRotationEnabled
            || lobby.rotationIntervalSecs == null
            || lobby.rotationIntervalSecs <= 0
            || lobby.lastRoleSwitchAt == null
        ) {
            return null;
        }

        const nextRotationAtMs = new Date(lobby.lastRoleSwitchAt).getTime() + lobby.rotationIntervalSecs * 1000;
        const remainingMs = nextRotationAtMs - nowTimestampMs;
        if (remainingMs <= 0) {
            return 0;
        }
        return Math.ceil(remainingMs / 1000);
    }, [lobby, lobbyStatus, nowTimestampMs]);

    useEffect(() => {
        if (
            !lobby
            || lobby.hostUserId !== currentUserId
            || rotationRemainingSeconds !== 0
            || isAutoRotatingRoles
        ) {
            return;
        }

        let cancelled = false;

        const rotateRoles = async (): Promise<void> => {
            setIsAutoRotatingRoles(true);
            try {
                const updatedLobby = await rotateLobbyRoles(lobby.id);
                if (cancelled) {
                    return;
                }
                setLobby(updatedLobby);
                setErrorMessage(null);
            } catch (error) {
                if (cancelled) {
                    return;
                }
                const message = getErrorMessage(error, "Failed to rotate lobby roles.");
                if (!message.toLowerCase().includes("has not elapsed")) {
                    setErrorMessage(message);
                }
            } finally {
                if (!cancelled) {
                    setIsAutoRotatingRoles(false);
                }
            }
        };

        void rotateRoles();

        return () => {
            cancelled = true;
        };
    }, [lobby, currentUserId, rotationRemainingSeconds, isAutoRotatingRoles]);

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-slate-300">
                Loading lobby...
            </div>
        );
    }

    if (!lobby) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-white">
                <div className="max-w-md space-y-2 rounded-lg border border-slate-700 bg-slate-800 p-5">
                    <h1 className="text-xl font-bold">Lobby unavailable</h1>
                    <p className="text-slate-300">{errorMessage ?? "This lobby could not be loaded."}</p>
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-sm text-sky-300 underline underline-offset-4 hover:text-sky-200"
                    >
                        Back to lobbies
                    </button>
                </div>
            </div>
        );
    }

    const canStart = currentUserId !== null
        && lobby.hostUserId === currentUserId
        && lobby.status.toUpperCase() !== "ACTIVE"
        && lobby.status.toUpperCase() !== "CLOSED";
    const isHost = currentUserId !== null && lobby.hostUserId === currentUserId;
    const canStop = isHost && lobby.status.toUpperCase() === "ACTIVE";
    const isActiveLobby = lobby.status.toUpperCase() === "ACTIVE";
    const hostSettingsDisabled = lobby.status.toUpperCase() === "ACTIVE";

    const extraTabs: MonacoExtraTab[] = [
        {
            id: "lobby-details",
            label: "Lobby Details",
            icon: ClipboardList,
            activeClassName:
                "border-amber-300/90 bg-amber-400/20 text-amber-50 shadow-[0_0_0_1px_rgba(253,230,138,0.35)]",
            content: (
                <LobbyDetailsPanel
                    lobby={lobby}
                    currentUserId={currentUserId}
                    isUpdatingSettings={isUpdatingSettings}
                    hostSettingsDisabled={hostSettingsDisabled}
                    onUpdateSettings={handleUpdateLobbySettings}
                />
            ),
        },
        {
            id: "participants",
            label: "Participants",
            icon: Users2,
            content: (
                <LobbyParticipantsPanel
                    participants={lobby.participants}
                    hostUserId={lobby.hostUserId}
                    currentDriverUserId={lobby.currentDriverUserId}
                    currentUserId={currentUserId}
                    cursorPresenceByUserId={cursorPresenceByUserId}
                    currentFilename={lobby.language.entryFilename}
                    isHost={isHost}
                    hostActionsDisabled={hostSettingsDisabled}
                    activeParticipantActionUserId={activeParticipantActionUserId}
                    onUpdateRole={handleUpdateParticipantRole}
                    onTransferHost={handleTransferHost}
                />
            ),
        },
    ];

    return (
        <WorkspaceLayout
            challengePanel={(
                <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/85 shadow-[0_10px_30px_rgba(2,6,23,0.35)]">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 bg-gradient-to-r from-slate-900 to-slate-800/90 px-4 py-3">
                        <button
                            type="button"
                            onClick={onBack}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back to lobbies
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getLobbyStatusClasses(lobby.status)}`}
                            >
                                {lobby.status}
                            </span>
                            {rotationRemainingSeconds !== null && (
                                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-cyan-200">
                                    Rotate in {formatCountdown(rotationRemainingSeconds)}
                                </span>
                            )}
                        </div>
                    </div>

                    {errorMessage && (
                        <div className="mx-4 mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                            {errorMessage}
                        </div>
                    )}

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
                        <ChallengePanel slug={lobby.challenge.slug} />
                    </div>
                </section>
            )}
            editorPanel={(
                <section className="h-full min-h-0 min-w-0 flex-1">
                    <MonacoEditor
                        challengeSlug={lobby.challenge.slug}
                        preferredLanguageId={lobby.language.id}
                        disableLanguageSelection
                        collaborationMode
                        lobbyId={lobby.id}
                        currentUserId={currentUserId}
                        collaborationInitialText={lobby.language.starterCode}
                        enableCollaborationInitialSeed={isHost}
                        collaborators={lobby.participants}
                        onCursorPresenceChange={setCursorPresenceByUserId}
                        extraTabs={extraTabs}
                        headerActions={(
                            <>
                                <button
                                    type="button"
                                    onClick={() => void (isActiveLobby ? handleStop() : handleStart())}
                                    disabled={
                                        isActiveLobby
                                            ? (!canStop || isStopping || isStarting || isLeaving)
                                            : (!canStart || isStarting || isStopping || isLeaving)
                                    }
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                        isActiveLobby
                                            ? "border-amber-300/50 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
                                            : "border-sky-300/60 bg-sky-400/20 text-sky-50 hover:bg-sky-400/30"
                                    }`}
                                    title={
                                        isActiveLobby
                                            ? (canStop ? "Stop lobby" : "Only the host can stop an active lobby")
                                            : (canStart ? "Start lobby" : "Only the host can start a waiting lobby")
                                    }
                                >
                                    <CirclePlay className="h-4 w-4" />
                                    {isActiveLobby ? (isStopping ? "Stopping..." : "Stop") : (isStarting ? "Starting..." : "Start")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleLeave()}
                                    disabled={isLeaving || isStarting || isStopping}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/50 bg-rose-400/15 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <LogOut className="h-4 w-4" />
                                    {isLeaving ? "Leaving..." : "Leave"}
                                </button>
                            </>
                        )}
                    />
                </section>
            )}
            isNarrowViewport={isNarrowViewport}
            splitContainerRef={splitContainerRef}
            leftPanelWidthPercent={leftPanelWidthPercent}
            isResizingPanels={isResizingPanels}
            setLeftPanelWidthPercent={setLeftPanelWidthPercent}
            setIsResizingPanels={setIsResizingPanels}
        />
    );
}

function App() {
    const [pathname, setPathname] = useState<string>(() =>
        normalizePathname(window.location.pathname)
    );
    const [leftPanelWidthPercent, setLeftPanelWidthPercent] = useState<number>(() => {
        const stored = localStorage.getItem("workspace_left_panel_width");
        const parsed = Number(stored);
        if (Number.isFinite(parsed) && parsed >= 25 && parsed <= 75) {
            return parsed;
        }
        return 36;
    });
    const [isResizingPanels, setIsResizingPanels] = useState(false);
    const [isNarrowViewport, setIsNarrowViewport] = useState<boolean>(() =>
        window.matchMedia("(max-width: 1023px)").matches
    );
    const splitContainerRef = useRef<HTMLDivElement | null>(null);
    const [authSession, setAuthSession] = useState(() => getStoredAuthSession());

    useEffect(() => {
        const handlePopState = () => {
            setPathname(normalizePathname(window.location.pathname));
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    useEffect(() => {
        const onStorageChange = (event: StorageEvent) => {
            if (!event.key || event.key.startsWith("pairwise.")) {
                setAuthSession(getStoredAuthSession());
            }
        };

        window.addEventListener("storage", onStorageChange);
        return () => window.removeEventListener("storage", onStorageChange);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const bootstrapAuth = async () => {
            const session = await bootstrapAuthSession();
            if (!cancelled) {
                setAuthSession(session);
            }
        };

        void bootstrapAuth();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 1023px)");
        const onViewportChange = (event: MediaQueryListEvent) => {
            setIsNarrowViewport(event.matches);
        };

        setIsNarrowViewport(mediaQuery.matches);
        mediaQuery.addEventListener("change", onViewportChange);
        return () => mediaQuery.removeEventListener("change", onViewportChange);
    }, []);

    useEffect(() => {
        localStorage.setItem("workspace_left_panel_width", String(leftPanelWidthPercent));
    }, [leftPanelWidthPercent]);

    useEffect(() => {
        if (!isResizingPanels || isNarrowViewport) {
            return;
        }

        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        const clampWidth = (value: number): number => Math.min(75, Math.max(25, value));
        const handlePointerMove = (event: MouseEvent) => {
            if (!splitContainerRef.current) {
                return;
            }

            const bounds = splitContainerRef.current.getBoundingClientRect();
            const nextWidth = ((event.clientX - bounds.left) / bounds.width) * 100;
            setLeftPanelWidthPercent(clampWidth(nextWidth));
        };

        const stopResize = () => {
            setIsResizingPanels(false);
        };

        window.addEventListener("mousemove", handlePointerMove);
        window.addEventListener("mouseup", stopResize);

        return () => {
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
            window.removeEventListener("mousemove", handlePointerMove);
            window.removeEventListener("mouseup", stopResize);
        };
    }, [isNarrowViewport, isResizingPanels]);

    const navigate = (to: string) => {
        const normalized = normalizePathname(to);
        if (normalized === pathname) {
            return;
        }
        window.history.pushState({}, "", normalized);
        setPathname(normalized);
        window.scrollTo({ top: 0, behavior: "auto" });
    };

    const slug = useMemo(() => getChallengeSlug(pathname), [pathname]);
    const lobbyId = useMemo(() => getLobbyId(pathname), [pathname]);
    const shouldShowNavbar = pathname !== "/login" && pathname !== "/register" && !slug && lobbyId === null;

    const onAuthSuccess = () => {
        setAuthSession(getStoredAuthSession());
        navigate("/challenges");
    };

    const onLogout = () => {
        void (async () => {
            try {
                await logoutFromServer();
            } catch {
                // Always clear local session state even if server-side logout fails.
            } finally {
                clearAuthSession();
                setAuthSession(null);
                navigate("/login");
            }
        })();
    };

    let pageContent: ReactElement;

    if (pathname === "/login") {
        pageContent = (
            <LoginPage
                onSuccess={onAuthSuccess}
                onOpenRegister={() => navigate("/register")}
                onOpenChallenges={() => navigate("/challenges")}
            />
        );
    } else if (pathname === "/register") {
        pageContent = (
            <RegisterPage
                onSuccess={onAuthSuccess}
                onOpenLogin={() => navigate("/login")}
                onOpenChallenges={() => navigate("/challenges")}
            />
        );
    } else if (pathname === "/" || pathname === "/challenges") {
        pageContent = (
            <ChallengesPage
                onOpenChallenge={(challengeSlug) =>
                    navigate(`/challenges/${encodeURIComponent(challengeSlug)}`)
                }
            />
        );
    } else if (pathname === "/lobbies") {
        if (!authSession) {
            pageContent = (
                <LoginPage
                    onSuccess={onAuthSuccess}
                    onOpenRegister={() => navigate("/register")}
                    onOpenChallenges={() => navigate("/challenges")}
                />
            );
        } else {
        pageContent = (
            <LobbiesPage
                onOpenLobby={(nextLobbyId) => navigate(`/lobbies/${nextLobbyId}`)}
            />
        );
        }
    } else if (lobbyId !== null) {
        if (!authSession) {
            pageContent = (
                <LoginPage
                    onSuccess={onAuthSuccess}
                    onOpenRegister={() => navigate("/register")}
                    onOpenChallenges={() => navigate("/challenges")}
                />
            );
        } else {
        pageContent = (
            <LobbyWorkspacePage
                lobbyId={lobbyId}
                currentUserId={authSession?.userId ?? null}
                onBack={() => navigate("/lobbies")}
                isNarrowViewport={isNarrowViewport}
                splitContainerRef={splitContainerRef}
                leftPanelWidthPercent={leftPanelWidthPercent}
                isResizingPanels={isResizingPanels}
                setLeftPanelWidthPercent={setLeftPanelWidthPercent}
                setIsResizingPanels={setIsResizingPanels}
            />
        );
        }
    } else if (slug) {
        const challengePanel = (
            <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/85 shadow-[0_10px_30px_rgba(2,6,23,0.35)]">
                <div className="flex items-center justify-between border-b border-slate-700/70 bg-gradient-to-r from-slate-900 to-slate-800/90 px-4 py-3">
                    <button
                        type="button"
                        onClick={() => navigate("/challenges")}
                        className="rounded-md border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
                    >
                        Back to challenges
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
                    <ChallengePanel slug={slug} />
                </div>
            </section>
        );

        const editorPanel = (
            <section className="h-full min-h-0 min-w-0 flex-1">
                <MonacoEditor challengeSlug={slug} />
            </section>
        );

        pageContent = (
            <WorkspaceLayout
                challengePanel={challengePanel}
                editorPanel={editorPanel}
                isNarrowViewport={isNarrowViewport}
                splitContainerRef={splitContainerRef}
                leftPanelWidthPercent={leftPanelWidthPercent}
                isResizingPanels={isResizingPanels}
                setLeftPanelWidthPercent={setLeftPanelWidthPercent}
                setIsResizingPanels={setIsResizingPanels}
            />
        );
    } else {
        pageContent = (
            <div className="flex h-full items-center justify-center p-6 text-white">
                <div className="max-w-md space-y-2 rounded-lg border border-gray-700 bg-gray-800 p-5">
                    <h1 className="text-xl font-bold">Page not found</h1>
                    <p className="text-gray-300">
                        This route does not exist.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate("/challenges")}
                        className="text-sm text-yellow-400 underline underline-offset-4 hover:text-yellow-300"
                    >
                        Go to challenges
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-dvh min-h-dvh flex-col bg-[#070d1a] text-slate-100">
            {shouldShowNavbar && (
                <AppNavbar
                    pathname={pathname}
                    isAuthenticated={authSession !== null}
                    displayName={authSession?.displayName || authSession?.username || null}
                    onNavigate={navigate}
                    onLogout={onLogout}
                />
            )}
            <main className={`min-h-0 flex-1 ${slug || (lobbyId !== null && authSession !== null) ? "overflow-hidden" : "overflow-y-auto"}`}>
                {pageContent}
            </main>
        </div>
    );
}

export default App;
