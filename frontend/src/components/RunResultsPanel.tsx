import type { SandboxRunTestsResponse, SandboxTestCaseResult } from "../types/sandbox";

type RunResultsPanelProps = {
    isRunning: boolean;
    result: SandboxRunTestsResponse | null;
    errorMessage: string | null;
    languageLabel: string | null;
};

function getStatusClasses(status: string): string {
    switch (status.toUpperCase()) {
        case "PASSED":
        case "SUCCESS":
            return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
        case "WRONG_ANSWER":
        case "FAILED":
            return "border-amber-500/40 bg-amber-500/10 text-amber-300";
        case "TIMEOUT":
            return "border-orange-500/40 bg-orange-500/10 text-orange-300";
        default:
            return "border-rose-500/40 bg-rose-500/10 text-rose-300";
    }
}

function getPassRate(result: SandboxRunTestsResponse): string {
    if (result.totalTests === 0) {
        return "0%";
    }

    return `${Math.round((result.passedTests / result.totalTests) * 100)}%`;
}

function formatExecutionTime(value: number | null): string {
    if (value == null) {
        return "-";
    }
    return `${value} ms`;
}

function ResultCaseCard({ testResult }: { testResult: SandboxTestCaseResult }) {
    return (
        <article className="rounded-xl border border-slate-700/80 bg-slate-900/80 shadow-[0_8px_24px_rgba(2,6,23,0.3)]">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 px-4 py-3">
                <h4 className="text-sm font-semibold text-slate-100">Test {testResult.testNumber}</h4>
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusClasses(testResult.status)}`}
                    >
                        {testResult.status.replaceAll("_", " ")}
                    </span>
                    <span className="text-xs text-slate-400">{formatExecutionTime(testResult.executionTimeMs)}</span>
                </div>
            </header>

            <div className="space-y-3 p-4 text-xs text-slate-300">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                    <span>Exit Code: {testResult.exitCode ?? "-"}</span>
                    <span>Runtime: {formatExecutionTime(testResult.executionTimeMs)}</span>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                    <div>
                        <p className="mb-1 uppercase tracking-wide text-slate-400">Input</p>
                        <pre className="overflow-x-auto rounded-md bg-slate-950/80 p-2.5 text-[11px] whitespace-pre-wrap">
                            {testResult.input}
                        </pre>
                    </div>
                    <div>
                        <p className="mb-1 uppercase tracking-wide text-slate-400">Expected</p>
                        <pre className="overflow-x-auto rounded-md bg-slate-950/80 p-2.5 text-[11px] whitespace-pre-wrap">
                            {testResult.expectedOutput}
                        </pre>
                    </div>
                    <div>
                        <p className="mb-1 uppercase tracking-wide text-slate-400">Actual</p>
                        <pre className="overflow-x-auto rounded-md bg-slate-950/80 p-2.5 text-[11px] whitespace-pre-wrap">
                            {testResult.actualOutput.length > 0 ? testResult.actualOutput : "(empty)"}
                        </pre>
                    </div>
                </div>

                {(testResult.stderr?.trim().length ?? 0) > 0 && (
                    <div>
                        <p className="mb-1 uppercase tracking-wide text-rose-300/90">Runtime/Error Output</p>
                        <pre className="overflow-x-auto rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-200 whitespace-pre-wrap">
                            {testResult.stderr}
                        </pre>
                    </div>
                )}
            </div>
        </article>
    );
}

function RunResultsPanel({ isRunning, result, errorMessage, languageLabel }: RunResultsPanelProps) {
    if (isRunning) {
        return (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-4">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-500 border-t-cyan-300" />
                <p className="text-sm font-medium text-slate-300">Running tests in sandbox...</p>
            </div>
        );
    }

    if (errorMessage) {
        return (
            <div className="m-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                <p className="font-semibold">Run failed</p>
                <p className="mt-1">{errorMessage}</p>
            </div>
        );
    }

    if (!result) {
        return (
            <div className="flex h-full min-h-[220px] items-center justify-center px-6 text-center text-sm text-slate-400">
                Click <span className="mx-1 font-semibold text-slate-200">Run Tests</span> to execute your current code.
            </div>
        );
    }

    return (
        <div className="h-full min-h-0 overflow-y-auto p-4">
            <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-[0_10px_30px_rgba(2,6,23,0.3)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Run Summary</p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-100">
                            {result.challengeSlug}
                            {languageLabel ? ` · ${languageLabel}` : ""}
                        </h3>
                    </div>
                    <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusClasses(result.status)}`}
                    >
                        {result.status}
                    </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Passed</p>
                        <p className="mt-1 text-xl font-semibold text-emerald-300">{result.passedTests}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Failed</p>
                        <p className="mt-1 text-xl font-semibold text-rose-300">{result.failedTests}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Pass Rate</p>
                        <p className="mt-1 text-xl font-semibold text-sky-300">{getPassRate(result)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Total Runtime</p>
                        <p className="mt-1 text-xl font-semibold text-slate-100">{result.totalExecutionTimeMs} ms</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Avg / Test</p>
                        <p className="mt-1 text-xl font-semibold text-slate-100">{result.averageExecutionTimeMs} ms</p>
                    </div>
                </div>

                <div className="mt-3 text-xs text-slate-400">
                    Limits: {result.timeLimitMs} ms per test · {result.memoryLimitMb} MB memory cap
                </div>
            </div>

            <div className="mt-4 space-y-3">
                {result.testResults.map((testResult) => (
                    <ResultCaseCard key={testResult.testNumber} testResult={testResult} />
                ))}
            </div>
        </div>
    );
}

export default RunResultsPanel;
