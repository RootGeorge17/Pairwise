import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Code2, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { editor as MonacoEditorNamespace } from "monaco-editor";
import type { ChallengeLanguage, LobbyParticipant } from "../types/challenge";
import type { SandboxRunTestsResponse, SubmitCodeResponse } from "../types/sandbox";
import { fetchChallengeBySlug, getErrorMessage, runChallengeTests, submitChallengeCode } from "../lib/challengesApi";
import { useLobbyCollaboration } from "../hooks/useLobbyCollaboration";
import type { LobbyCursorPresence } from "../hooks/useLobbyCollaboration";
import RunResultsPanel, { type ExecutionMode } from "./RunResultsPanel";

import Editor from "@monaco-editor/react";

export type MonacoExtraTab = {
    id: string;
    label: string;
    icon?: LucideIcon;
    content: ReactNode;
    activeClassName?: string;
};

type MonacoEditorProps = {
    challengeSlug?: string;
    preferredLanguageId?: number | null;
    disableLanguageSelection?: boolean;
    extraTabs?: MonacoExtraTab[];
    headerActions?: ReactNode;
    collaborationMode?: boolean;
    lobbyId?: number | null;
    currentUserId?: number | null;
    collaborationInitialText?: string | null;
    enableCollaborationInitialSeed?: boolean;
    collaborators?: LobbyParticipant[];
    onCursorPresenceChange?: (cursorPresenceByUserId: Record<number, LobbyCursorPresence>) => void;
};

type WorkspaceTab = "editor" | "results" | string;

const FALLBACK_CODE = "// some comment";
const REMOTE_CURSOR_COLOR_VARIANTS_COUNT = 6;

function getRemoteCursorColorIndex(userId: number): number {
    return Math.abs(userId) % REMOTE_CURSOR_COLOR_VARIANTS_COUNT;
}

type CursorLabelWidget = MonacoEditorNamespace.IContentWidget & {
    setLabel: (label: string) => void;
    setColorIndex: (colorIndex: number) => void;
    setPosition: (line: number, column: number) => void;
};

function createCursorLabelWidget(
    monaco: typeof import("monaco-editor"),
    userId: number,
    label: string,
    colorIndex: number,
    line: number,
    column: number,
): CursorLabelWidget {
    const node = document.createElement("div");
    const position = { lineNumber: line, column };
    const widgetId = `lobby-cursor-label-widget-${userId}`;

    const setLabel = (nextLabel: string) => {
        node.textContent = nextLabel;
        node.setAttribute("aria-label", nextLabel);
    };

    const setColorIndex = (nextColorIndex: number) => {
        node.className = `lobby-remote-cursor-widget lobby-remote-cursor-widget-${nextColorIndex}`;
    };

    const setPosition = (nextLine: number, nextColumn: number) => {
        position.lineNumber = nextLine;
        position.column = nextColumn;
    };

    setColorIndex(colorIndex);
    setLabel(label);

    return {
        getId: () => widgetId,
        getDomNode: () => node,
        getPosition: () => ({
            position,
            preference: [
                monaco.editor.ContentWidgetPositionPreference.ABOVE,
                monaco.editor.ContentWidgetPositionPreference.BELOW,
            ],
        }),
        setLabel,
        setColorIndex,
        setPosition,
    };
}

function getStorageKey(challengeSlug?: string, languageId?: number | null): string {
    if (!challengeSlug) {
        return "solo:code";
    }
    if (!languageId) {
        return `solo:code:${challengeSlug}`;
    }
    return `solo:code:${challengeSlug}:${languageId}`;
}

function getDefaultLanguage(languages: ChallengeLanguage[]): ChallengeLanguage | null {
    if (languages.length === 0) {
        return null;
    }

    return languages.find((language) => language.isDefault) ?? languages[0];
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

function getMonacoLanguage(language?: string): string {
    if (!language) {
        return "plaintext";
    }
    switch (language.toUpperCase()) {
        case "JAVASCRIPT":
            return "javascript";
        case "PYTHON":
            return "python";
        default:
            return "plaintext";
    }
}

function MonacoEditor({
    challengeSlug,
    preferredLanguageId = null,
    disableLanguageSelection = false,
    extraTabs = [],
    headerActions,
    collaborationMode = false,
    lobbyId = null,
    currentUserId = null,
    collaborationInitialText = null,
    enableCollaborationInitialSeed = false,
    collaborators = [],
    onCursorPresenceChange,
}: MonacoEditorProps) {
    const [code, setCode] = useState(FALLBACK_CODE);
    const [languages, setLanguages] = useState<ChallengeLanguage[]>([]);
    const [selectedLanguageId, setSelectedLanguageId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<WorkspaceTab>("editor");
    const [isLoading, setIsLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isRunningTests, setIsRunningTests] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRemoteExecutionLoading, setIsRemoteExecutionLoading] = useState(false);
    const [executionMode, setExecutionMode] = useState<ExecutionMode>(null);
    const [executionError, setExecutionError] = useState<string | null>(null);
    const [executionResult, setExecutionResult] = useState<SandboxRunTestsResponse | SubmitCodeResponse | null>(null);
    const editorInstanceRef = useRef<MonacoEditorNamespace.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
    const remoteCursorDecorationIdsRef = useRef<string[]>([]);
    const cursorLabelWidgetsRef = useRef<Map<number, CursorLabelWidget>>(new Map());
    const {
        editorReady: collaborationEditorReady,
        connectionState,
        cursorPresenceByUserId,
        latestExecutionEvent,
        bindEditor,
        sendExecutionEvent,
        getCurrentSharedText,
    } = useLobbyCollaboration({
        lobbyId: collaborationMode ? lobbyId : null,
        currentUserId: collaborationMode ? currentUserId : null,
        initialPlainText: collaborationMode ? collaborationInitialText : null,
        allowInitialPlainTextSeed: collaborationMode ? enableCollaborationInitialSeed : false,
    });

    useEffect(() => {
        if (!onCursorPresenceChange) {
            return;
        }
        onCursorPresenceChange(cursorPresenceByUserId);
    }, [cursorPresenceByUserId, onCursorPresenceChange]);

    useEffect(() => {
        if (!collaborationMode) {
            return;
        }

        const editor = editorInstanceRef.current;
        const monaco = monacoRef.current;
        const model = editor?.getModel();
        if (!editor || !monaco || !model) {
            return;
        }

        const participantNameById = new Map(
            collaborators.map((participant) => [
                participant.userId,
                participant.displayName?.trim().length ? participant.displayName : participant.username,
            ]),
        );

        const lineCount = model.getLineCount();
        const nextDecorations = Object.entries(cursorPresenceByUserId)
            .map(([userIdText, presence]) => {
                const userId = Number(userIdText);
                if (!Number.isFinite(userId) || !presence) {
                    return [];
                }
                if (currentUserId != null && userId === currentUserId) {
                    return [];
                }

                const participantName = participantNameById.get(userId) ?? `User ${userId}`;
                const label = participantName;
                const colorIndex = getRemoteCursorColorIndex(userId);

                const line = Math.max(1, Math.min(lineCount, presence.line));
                const maxCursorColumn = model.getLineMaxColumn(line);
                const column = Math.max(1, Math.min(maxCursorColumn, presence.column));

                const selectionStartLine = Math.max(1, Math.min(lineCount, presence.selectionStartLine));
                const selectionEndLine = Math.max(1, Math.min(lineCount, presence.selectionEndLine));
                const selectionStartColumn = Math.max(
                    1,
                    Math.min(model.getLineMaxColumn(selectionStartLine), presence.selectionStartColumn),
                );
                const selectionEndColumn = Math.max(
                    1,
                    Math.min(model.getLineMaxColumn(selectionEndLine), presence.selectionEndColumn),
                );
                const hasSelection = !(
                    selectionStartLine === selectionEndLine && selectionStartColumn === selectionEndColumn
                );

                const decorations: MonacoEditorNamespace.IModelDeltaDecoration[] = [
                    {
                        range: new monaco.Range(line, 1, line, maxCursorColumn),
                        options: {
                            isWholeLine: true,
                            className: `lobby-remote-cursor-line-${colorIndex}`,
                            overviewRuler: {
                                color: "rgba(148, 163, 184, 0.35)",
                                position: monaco.editor.OverviewRulerLane.Full,
                            },
                            minimap: {
                                color: "rgba(148, 163, 184, 0.35)",
                                position: monaco.editor.MinimapPosition.Inline,
                            },
                        },
                    },
                    {
                        range: new monaco.Range(line, column, line, column),
                        options: {
                            className: `lobby-remote-cursor-head-${colorIndex}`,
                            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                        },
                    },
                ];

                const existingWidget = cursorLabelWidgetsRef.current.get(userId);
                if (existingWidget) {
                    existingWidget.setLabel(label);
                    existingWidget.setColorIndex(colorIndex);
                    existingWidget.setPosition(line, column);
                    editor.layoutContentWidget(existingWidget);
                } else {
                    const widget = createCursorLabelWidget(monaco, userId, label, colorIndex, line, column);
                    cursorLabelWidgetsRef.current.set(userId, widget);
                    editor.addContentWidget(widget);
                }

                if (hasSelection) {
                    decorations.push({
                        range: new monaco.Range(
                            selectionStartLine,
                            selectionStartColumn,
                            selectionEndLine,
                            selectionEndColumn,
                        ),
                        options: {
                            className: `lobby-remote-selection-${colorIndex}`,
                            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                        },
                    });
                }

                return decorations;
            })
            .flat();

        const activeUserIds = new Set(
            Object.keys(cursorPresenceByUserId)
                .map((userId) => Number(userId))
                .filter((userId) => Number.isFinite(userId) && (currentUserId == null || userId !== currentUserId)),
        );
        cursorLabelWidgetsRef.current.forEach((widget, userId) => {
            if (!activeUserIds.has(userId)) {
                editor.removeContentWidget(widget);
                cursorLabelWidgetsRef.current.delete(userId);
            }
        });

        remoteCursorDecorationIdsRef.current = editor.deltaDecorations(
            remoteCursorDecorationIdsRef.current,
            nextDecorations,
        );
    }, [collaborationEditorReady, collaborationMode, collaborators, currentUserId, cursorPresenceByUserId]);

    useEffect(() => {
        if (!collaborationMode) {
            return;
        }
        return () => {
            const editor = editorInstanceRef.current;
            if (editor) {
                editor.deltaDecorations(remoteCursorDecorationIdsRef.current, []);
                cursorLabelWidgetsRef.current.forEach((widget) => {
                    editor.removeContentWidget(widget);
                });
            }
            remoteCursorDecorationIdsRef.current = [];
            cursorLabelWidgetsRef.current.clear();
        };
    }, [collaborationMode]);

    useEffect(() => {
        if (!challengeSlug) {
            setLanguages([]);
            setSelectedLanguageId(null);
            setLoadError(null);
            setExecutionError(null);
            setExecutionResult(null);
            setExecutionMode(null);
            if (!collaborationMode) {
                setCode(localStorage.getItem(getStorageKey()) ?? FALLBACK_CODE);
            } else {
                setCode(FALLBACK_CODE);
            }
            setIsLoading(false);
            setIsReady(true);
            return;
        }

        const controller = new AbortController();
        setIsLoading(true);
        setIsReady(false);
        setLoadError(null);

        const loadChallengeContext = async () => {
            try {
                const challenge = await fetchChallengeBySlug(challengeSlug, controller.signal);
                const availableLanguages = challenge.languages;
                const preferredLanguage = preferredLanguageId
                    ? availableLanguages.find((language) => language.id === preferredLanguageId) ?? null
                    : null;
                const defaultLanguage = preferredLanguage ?? getDefaultLanguage(availableLanguages);

                setLanguages(availableLanguages);
                setSelectedLanguageId(defaultLanguage?.id ?? null);
            } catch {
                if (controller.signal.aborted) {
                    return;
                }
                setLanguages([]);
                setSelectedLanguageId(null);
                if (!collaborationMode) {
                    setCode(FALLBACK_CODE);
                }
                setExecutionError(null);
                setExecutionResult(null);
                setExecutionMode(null);
                setLoadError("Failed to load challenge editor context.");
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                    setIsReady(true);
                }
            }
        };

        void loadChallengeContext();

        return () => controller.abort();
    }, [challengeSlug, collaborationMode, preferredLanguageId]);

    useEffect(() => {
        if (!preferredLanguageId) {
            return;
        }

        const languageExists = languages.some((language) => language.id === preferredLanguageId);
        if (languageExists && selectedLanguageId !== preferredLanguageId) {
            setSelectedLanguageId(preferredLanguageId);
        }
    }, [languages, preferredLanguageId, selectedLanguageId]);

    useEffect(() => {
        if (activeTab === "editor" || activeTab === "results") {
            return;
        }

        const extraTabExists = extraTabs.some((extraTab) => extraTab.id === activeTab);
        if (!extraTabExists) {
            setActiveTab("editor");
        }
    }, [activeTab, extraTabs]);

    useEffect(() => {
        if (!collaborationMode || !latestExecutionEvent) {
            return;
        }

        setExecutionMode(latestExecutionEvent.mode);
        setActiveTab("results");

        if (latestExecutionEvent.phase === "started") {
            setIsRemoteExecutionLoading(true);
            setExecutionError(null);
            setExecutionResult(null);
            return;
        }

        setIsRemoteExecutionLoading(false);
        setExecutionError(latestExecutionEvent.errorMessage ?? null);
        setExecutionResult((latestExecutionEvent.result as SandboxRunTestsResponse | SubmitCodeResponse | null) ?? null);
    }, [collaborationMode, latestExecutionEvent]);

    useEffect(() => {
        setExecutionError(null);
        setExecutionResult(null);
        setExecutionMode(null);
        setIsRemoteExecutionLoading(false);
    }, [challengeSlug, selectedLanguageId]);

    useEffect(() => {
        if (collaborationMode) {
            return;
        }

        if (!isReady) {
            return;
        }

        const selectedLanguage = languages.find((language) => language.id === selectedLanguageId) ?? null;
        const storageKey = getStorageKey(challengeSlug, selectedLanguageId);
        const savedCode = localStorage.getItem(storageKey);

        if (savedCode !== null) {
            setCode(savedCode);
            return;
        }

        const initialCode = selectedLanguage?.starterCode ?? FALLBACK_CODE;
        setCode(initialCode);
        localStorage.setItem(storageKey, initialCode);
    }, [challengeSlug, collaborationMode, isReady, languages, selectedLanguageId]);

    function handleEditorChange(value: string | undefined): void {
        if (collaborationMode) {
            return;
        }

        if (value !== undefined) {
            setCode(value);
            localStorage.setItem(getStorageKey(challengeSlug, selectedLanguageId), value);
        }
    }

    function getCurrentSourceCode(): string {
        if (collaborationMode) {
            return getCurrentSharedText();
        }
        return code;
    }

    async function handleRunTests(): Promise<void> {
        if (isRunningTests || isSubmitting) {
            return;
        }

        setExecutionMode("run");
        setActiveTab("results");
        setIsRemoteExecutionLoading(false);

        if (!challengeSlug || !selectedLanguage) {
            setExecutionResult(null);
            setExecutionError("Select a challenge and language before running tests.");
            return;
        }

        setIsRunningTests(true);
        setExecutionError(null);
        if (collaborationMode) {
            sendExecutionEvent({
                mode: "run",
                phase: "started",
                actorUserId: currentUserId ?? null,
                updatedAt: Date.now(),
            });
        }

        try {
            const result = await runChallengeTests({
                slug: challengeSlug,
                language: selectedLanguage.language,
                sourceCode: getCurrentSourceCode(),
            });
            setExecutionResult(result);
            if (collaborationMode) {
                sendExecutionEvent({
                    mode: "run",
                    phase: "finished",
                    actorUserId: currentUserId ?? null,
                    result,
                    errorMessage: null,
                    updatedAt: Date.now(),
                });
            }
        } catch (error) {
            setExecutionResult(null);
            const message = getErrorMessage(error, "Failed to run tests.");
            setExecutionError(message);
            if (collaborationMode) {
                sendExecutionEvent({
                    mode: "run",
                    phase: "finished",
                    actorUserId: currentUserId ?? null,
                    result: null,
                    errorMessage: message,
                    updatedAt: Date.now(),
                });
            }
        } finally {
            setIsRunningTests(false);
        }
    }

    async function handleSubmitCode(): Promise<void> {
        if (isRunningTests || isSubmitting) {
            return;
        }

        setExecutionMode("submit");
        setActiveTab("results");
        setIsRemoteExecutionLoading(false);

        if (!challengeSlug || !selectedLanguage) {
            setExecutionResult(null);
            setExecutionError("Select a challenge and language before submitting.");
            return;
        }

        setIsSubmitting(true);
        setExecutionError(null);
        if (collaborationMode) {
            sendExecutionEvent({
                mode: "submit",
                phase: "started",
                actorUserId: currentUserId ?? null,
                updatedAt: Date.now(),
            });
        }

        try {
            const result = await submitChallengeCode({
                slug: challengeSlug,
                language: selectedLanguage.language,
                sourceCode: getCurrentSourceCode(),
            });
            setExecutionResult(result);
            if (collaborationMode) {
                sendExecutionEvent({
                    mode: "submit",
                    phase: "finished",
                    actorUserId: currentUserId ?? null,
                    result,
                    errorMessage: null,
                    updatedAt: Date.now(),
                });
            }
        } catch (error) {
            setExecutionResult(null);
            const message = getErrorMessage(error, "Failed to submit solution.");
            setExecutionError(message);
            if (collaborationMode) {
                sendExecutionEvent({
                    mode: "submit",
                    phase: "finished",
                    actorUserId: currentUserId ?? null,
                    result: null,
                    errorMessage: message,
                    updatedAt: Date.now(),
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    function handleRestoreStarterCode(): void {
        if (!selectedLanguage) {
            return;
        }

        const starterCode = selectedLanguage.starterCode ?? FALLBACK_CODE;
        if (collaborationMode) {
            const editorModel = editorInstanceRef.current?.getModel();
            if (editorModel) {
                editorModel.setValue(starterCode);
            }
            return;
        }

        setCode(starterCode);
        localStorage.setItem(getStorageKey(challengeSlug, selectedLanguageId), starterCode);
    }

    const selectedLanguage = languages.find((language) => language.id === selectedLanguageId) ?? null;
    const monacoLanguage = getMonacoLanguage(selectedLanguage?.language);
    const isLoadingEditor = !isReady || isLoading;
    const selectedLanguageLabel = selectedLanguage ? formatLanguageLabel(selectedLanguage.language) : null;
    const activeExtraTab = extraTabs.find((extraTab) => extraTab.id === activeTab) ?? null;
    const editorInstanceKey = `${collaborationMode ? "collab" : "solo"}:${lobbyId ?? "none"}:${challengeSlug ?? "none"}:${selectedLanguageId ?? "none"}`;

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/85 shadow-[0_10px_35px_rgba(2,6,23,0.45)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/70 bg-gradient-to-r from-slate-900 to-slate-800/90 px-4 py-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab("editor")}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition ${
                                activeTab === "editor"
                                    ? "border-sky-300/90 bg-sky-400/25 text-sky-50 shadow-[0_0_0_1px_rgba(125,211,252,0.35)]"
                                    : "border-slate-500/90 bg-slate-700/90 text-slate-100 hover:border-slate-300 hover:bg-slate-600"
                            }`}
                        >
                            <Code2 className="h-4 w-4" />
                            Editor
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("results")}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition ${
                                activeTab === "results"
                                    ? "border-emerald-300/90 bg-emerald-400/25 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.35)]"
                                    : "border-slate-500/90 bg-slate-700/90 text-slate-100 hover:border-slate-300 hover:bg-slate-600"
                            }`}
                        >
                            <FileText className="h-4 w-4" />
                            Results
                        </button>
                        {extraTabs.map((extraTab) => {
                            const Icon = extraTab.icon;
                            return (
                                <button
                                    key={extraTab.id}
                                    type="button"
                                    onClick={() => setActiveTab(extraTab.id)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition ${
                                        activeTab === extraTab.id
                                            ? extraTab.activeClassName ??
                                                "border-violet-300/90 bg-violet-400/25 text-violet-50 shadow-[0_0_0_1px_rgba(196,181,253,0.35)]"
                                            : "border-slate-500/90 bg-slate-700/90 text-slate-100 hover:border-slate-300 hover:bg-slate-600"
                                    }`}
                                >
                                    {Icon ? <Icon className="h-4 w-4" /> : null}
                                    {extraTab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {headerActions}
                    <select
                        value={selectedLanguageId ?? ""}
                        disabled={languages.length === 0 || disableLanguageSelection}
                        onChange={(event) => setSelectedLanguageId(Number(event.target.value))}
                        className="rounded-lg border border-slate-500 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {languages.length === 0 && <option value="">No language</option>}
                        {languages.map((language) => (
                            <option key={language.id} value={language.id}>
                                {formatLanguageLabel(language.language)}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={handleRestoreStarterCode}
                        disabled={isLoadingEditor || !selectedLanguage}
                        className="rounded-lg border border-amber-300/50 bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-70"
                        title="Restore challenge starter code"
                    >
                        Restore Starter
                    </button>

                    <button
                        type="button"
                        onClick={() => void handleRunTests()}
                        disabled={isLoadingEditor || !selectedLanguage || isRunningTests || isSubmitting}
                        className="rounded-lg border border-slate-500 bg-slate-700/90 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-300 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {isRunningTests ? "Running..." : "Run Tests"}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSubmitCode()}
                        disabled={isLoadingEditor || !selectedLanguage || isRunningTests || isSubmitting}
                        className="rounded-lg border border-emerald-300/60 bg-emerald-400/25 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/35 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {isSubmitting ? "Submitting..." : "Submit"}
                    </button>
                </div>
            </div>

            <div className="relative min-h-0 flex-1 bg-[#0b1220]">
                {activeTab === "results" ? (
                    <RunResultsPanel
                        isLoading={isRunningTests || isSubmitting || isRemoteExecutionLoading}
                        result={executionResult}
                        errorMessage={executionError}
                        languageLabel={selectedLanguageLabel}
                        mode={executionMode}
                    />
                ) : activeExtraTab ? (
                    <div className="h-full min-h-0 overflow-y-auto p-4">{activeExtraTab.content}</div>
                ) : isLoadingEditor ? (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                        Loading editor...
                    </div>
                ) : (
                    <Editor
                        key={editorInstanceKey}
                        height="100%"
                        theme="vs-dark"
                        language={monacoLanguage}
                        onMount={(editor, monaco) => {
                            editorInstanceRef.current = editor;
                            monacoRef.current = monaco;
                            if (collaborationMode) {
                                bindEditor(editor, monaco);
                            }
                        }}
                        {...(collaborationMode
                            ? { defaultValue: "" }
                            : { value: code, onChange: handleEditorChange })}
                        options={{
                            automaticLayout: true,
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineHeight: 22,
                            scrollBeyondLastLine: false,
                            padding: { top: 14, bottom: 14 },
                            wordWrap: "on",
                            smoothScrolling: true,
                            fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
                        }}
                    />
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/70 bg-slate-900/95 px-4 py-2 text-xs text-slate-400">
                <span>
                    {selectedLanguage
                        ? `${formatLanguageLabel(selectedLanguage.language)} · ${selectedLanguage.entryFilename}`
                        : "Language unavailable"}
                </span>
                <span>
                    Time and Memory Limits:&ensp;
                    {selectedLanguage
                        ? `${selectedLanguage.timeLimitMs} ms · ${selectedLanguage.memoryLimitMb} MB`
                        : "Autosave enabled"}
                    
                    {collaborationMode && (
                        <span className="pr-4 rounded-mdbg-slate-800/80 px-2 py-1 text-xs text-slate-200">
                            · Live: {connectionState}{!collaborationEditorReady ? " (binding...)" : ""}
                        </span>
                    )}
                </span>
                {loadError && <span className="text-rose-300">{loadError}</span>}
            </div>
        </div>
    );
}

export default MonacoEditor;
