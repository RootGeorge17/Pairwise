import { useEffect, useState } from "react";
import type { ChallengeLanguage } from "../types/challenge";
import type { SandboxRunTestsResponse, SubmitCodeResponse } from "../types/sandbox";
import { fetchChallengeBySlug, getErrorMessage, runChallengeTests, submitChallengeCode } from "../lib/challengesApi";
import RunResultsPanel, { type ExecutionMode } from "./RunResultsPanel";

import Editor from "@monaco-editor/react";

type MonacoEditorProps = {
    challengeSlug?: string;
};

type WorkspaceTab = "editor" | "results";

const FALLBACK_CODE = "// some comment";

function getStorageKey(challengeSlug?: string, languageId?: number | null): string {
    if (!challengeSlug) {
        return "code";
    }
    if (!languageId) {
        return `code:${challengeSlug}`;
    }
    return `code:${challengeSlug}:${languageId}`;
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

function MonacoEditor({ challengeSlug }: MonacoEditorProps) {
    const [code, setCode] = useState(FALLBACK_CODE);
    const [languages, setLanguages] = useState<ChallengeLanguage[]>([]);
    const [selectedLanguageId, setSelectedLanguageId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<WorkspaceTab>("editor");
    const [isLoading, setIsLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isRunningTests, setIsRunningTests] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [executionMode, setExecutionMode] = useState<ExecutionMode>(null);
    const [executionError, setExecutionError] = useState<string | null>(null);
    const [executionResult, setExecutionResult] = useState<SandboxRunTestsResponse | SubmitCodeResponse | null>(null);

    useEffect(() => {
        if (!challengeSlug) {
            setLanguages([]);
            setSelectedLanguageId(null);
            setLoadError(null);
            setExecutionError(null);
            setExecutionResult(null);
            setExecutionMode(null);
            setCode(localStorage.getItem(getStorageKey()) ?? FALLBACK_CODE);
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
                const defaultLanguage = getDefaultLanguage(availableLanguages);

                setLanguages(availableLanguages);
                setSelectedLanguageId(defaultLanguage?.id ?? null);
            } catch {
                if (controller.signal.aborted) {
                    return;
                }
                setLanguages([]);
                setSelectedLanguageId(null);
                setCode(FALLBACK_CODE);
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
    }, [challengeSlug]);

    useEffect(() => {
        setExecutionError(null);
        setExecutionResult(null);
        setExecutionMode(null);
    }, [challengeSlug, selectedLanguageId]);

    useEffect(() => {
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
    }, [challengeSlug, isReady, languages, selectedLanguageId]);

    function handleEditorChange(value: string | undefined): void {
        if (value !== undefined) {
            setCode(value);
            localStorage.setItem(getStorageKey(challengeSlug, selectedLanguageId), value);
        }
    }

    async function handleRunTests(): Promise<void> {
        if (isRunningTests || isSubmitting) {
            return;
        }

        setExecutionMode("run");
        setActiveTab("results");

        if (!challengeSlug || !selectedLanguage) {
            setExecutionResult(null);
            setExecutionError("Select a challenge and language before running tests.");
            return;
        }

        setIsRunningTests(true);
        setExecutionError(null);

        try {
            const result = await runChallengeTests({
                slug: challengeSlug,
                language: selectedLanguage.language,
                sourceCode: code,
            });
            setExecutionResult(result);
        } catch (error) {
            setExecutionResult(null);
            setExecutionError(getErrorMessage(error, "Failed to run tests."));
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

        if (!challengeSlug || !selectedLanguage) {
            setExecutionResult(null);
            setExecutionError("Select a challenge and language before submitting.");
            return;
        }

        setIsSubmitting(true);
        setExecutionError(null);

        try {
            const result = await submitChallengeCode({
                slug: challengeSlug,
                language: selectedLanguage.language,
                sourceCode: code,
            });
            setExecutionResult(result);
        } catch (error) {
            setExecutionResult(null);
            setExecutionError(getErrorMessage(error, "Failed to submit solution."));
        } finally {
            setIsSubmitting(false);
        }
    }

    const selectedLanguage = languages.find((language) => language.id === selectedLanguageId) ?? null;
    const monacoLanguage = getMonacoLanguage(selectedLanguage?.language);
    const isLoadingEditor = !isReady || isLoading;
    const selectedLanguageLabel = selectedLanguage ? formatLanguageLabel(selectedLanguage.language) : null;

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
                            <svg
                                viewBox="0 0 20 20"
                                aria-hidden="true"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M8 6 4 10l4 4" />
                                <path d="m12 6 4 4-4 4" />
                            </svg>
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
                            <svg
                                viewBox="0 0 20 20"
                                aria-hidden="true"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M6 3.5h6l3 3V16a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 16V5a1.5 1.5 0 0 1 1-1.41Z" />
                                <path d="M12 3.5V7h3" />
                                <path d="M7.5 10h5" />
                                <path d="M7.5 13h5" />
                            </svg>
                            Results
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={selectedLanguageId ?? ""}
                        disabled={languages.length === 0}
                        onChange={(event) => setSelectedLanguageId(Number(event.target.value))}
                        className="rounded-lg border border-slate-500 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none"
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
                        onClick={() => void handleRunTests()}
                        disabled={isLoadingEditor || !selectedLanguage || isRunningTests || isSubmitting}
                        className="rounded-lg border border-slate-500 bg-slate-700/90 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-300 hover:bg-slate-600"
                    >
                        {isRunningTests ? "Running..." : "Run Tests"}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSubmitCode()}
                        disabled={isLoadingEditor || !selectedLanguage || isRunningTests || isSubmitting}
                        className="rounded-lg border border-emerald-300/60 bg-emerald-400/25 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/35"
                    >
                        {isSubmitting ? "Submitting..." : "Submit"}
                    </button>
                </div>
            </div>

            <div className="relative min-h-0 flex-1 bg-[#0b1220]">
                {activeTab === "results" ? (
                    <RunResultsPanel
                        isLoading={isRunningTests || isSubmitting}
                        result={executionResult}
                        errorMessage={executionError}
                        languageLabel={selectedLanguageLabel}
                        mode={executionMode}
                    />
                ) : isLoadingEditor ? (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                        Loading editor...
                    </div>
                ) : (
                    <Editor
                        height="100%"
                        theme="vs-dark"
                        language={monacoLanguage}
                        onChange={handleEditorChange}
                        value={code}
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
                <span> Time and Memory Limits:&ensp;
                    {selectedLanguage
                        ? `${selectedLanguage.timeLimitMs} ms · ${selectedLanguage.memoryLimitMb} MB`
                        : "Autosave enabled"}
                </span>
                {loadError && <span className="text-rose-300">{loadError}</span>}
            </div>
        </div>
    );
}

export default MonacoEditor;
