import type {
    SandboxRunTestsResponse,
    SandboxTestCaseResult,
    SubmitCodeResponse,
    SubmitTestCaseResult,
} from "../types/sandbox";

export type ExecutionMode = "run" | "submit" | null;

type RunResultsPanelProps = {
    isLoading: boolean;
    result: SandboxRunTestsResponse | SubmitCodeResponse | null;
    errorMessage: string | null;
    languageLabel: string | null;
    mode: ExecutionMode;
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

function getPassRate(passed: number, total: number): string {
    if (total === 0) {
        return "0%";
    }
    return `${Math.round((passed / total) * 100)}%`;
}

function formatExecutionTime(value: number | null): string {
    if (value == null) {
        return "-";
    }
    return `${value} ms`;
}

function formatMemoryMb(value: number | null): string {
    if (value == null) {
        return "-";
    }
    return `${value} MB`;
}

function isSubmitCodeResponse(
    result: SandboxRunTestsResponse | SubmitCodeResponse
): result is SubmitCodeResponse {
    return "submissionId" in result;
}

function RunResultCaseCard({ testResult }: { testResult: SandboxTestCaseResult }) {
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
                    <span>Memory: {formatMemoryMb(testResult.memoryUsedMb)}</span>
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

function SubmitResultCaseCard({ testResult }: { testResult: SubmitTestCaseResult }) {
    return (
        <article className="rounded-xl border border-slate-700/80 bg-slate-900/80 shadow-[0_8px_24px_rgba(2,6,23,0.3)]">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 px-4 py-3">
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-100">Test {testResult.testNumber}</h4>
                    <span className="inline-flex rounded-full border border-slate-600 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                        {testResult.hidden ? "Hidden" : "Visible"}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusClasses(testResult.status)}`}
                    >
                        {testResult.status.replaceAll("_", " ")}
                    </span>
                </div>
            </header>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-[11px] text-slate-400">
                <span>Exit Code: {testResult.exitCode ?? "-"}</span>
                <span>Runtime: {formatExecutionTime(testResult.executionTimeMs)}</span>
                <span>Memory: {formatMemoryMb(testResult.memoryUsedMb)}</span>
            </div>
        </article>
    );
}

function mapSubmitVisibleResultToRunResult(
    testResult: SubmitTestCaseResult
): SandboxTestCaseResult {
    return {
        testNumber: testResult.testNumber,
        passed: testResult.passed,
        status: testResult.status,
        input: testResult.input,
        expectedOutput: testResult.expectedOutput,
        actualOutput: testResult.actualOutput,
        stdout: testResult.stdout,
        stderr: testResult.stderr,
        exitCode: testResult.exitCode,
        executionTimeMs: testResult.executionTimeMs,
        memoryUsedMb: testResult.memoryUsedMb,
    };
}

function RunResultsPanel({ isLoading, result, errorMessage, languageLabel, mode }: RunResultsPanelProps) {
    if (isLoading) {
        const message = mode === "submit" ? "Submitting solution for evaluation..." : "Running tests in sandbox...";
        return (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-4">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-500 border-t-cyan-300" />
                <p className="text-sm font-medium text-slate-300">{message}</p>
            </div>
        );
    }

    if (errorMessage) {
        const title = mode === "submit" ? "Submit failed" : "Run failed";
        return (
            <div className="m-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                <p className="font-semibold">{title}</p>
                <p className="mt-1">{errorMessage}</p>
            </div>
        );
    }

    if (!result) {
        const actionLabel = mode === "submit" ? "Submit" : "Run Tests";
        return (
            <div className="flex h-full min-h-[220px] items-center justify-center px-6 text-center text-sm text-slate-400">
                Click <span className="mx-1 font-semibold text-slate-200">{actionLabel}</span> to execute your current code.
            </div>
        );
    }

    if (isSubmitCodeResponse(result)) {
        const submitResult = result;
        return (
            <div className="h-full min-h-0 overflow-y-auto p-4">
                <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-[0_10px_30px_rgba(2,6,23,0.3)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Submission Summary</p>
                            <h3 className="mt-1 text-lg font-semibold text-slate-100">
                                {submitResult.challengeSlug}
                                {languageLabel ? ` · ${languageLabel}` : ""}
                            </h3>
                        </div>
                        <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusClasses(submitResult.status)}`}
                        >
                            {submitResult.status}
                        </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                        <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Passed</p>
                            <p className="mt-1 text-xl font-semibold text-emerald-300">{submitResult.passedTests}</p>
                        </div>
                        <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Failed</p>
                            <p className="mt-1 text-xl font-semibold text-rose-300">{submitResult.failedTests}</p>
                        </div>
                        <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Score</p>
                            <p className="mt-1 text-xl font-semibold text-sky-300">
                                {getPassRate(submitResult.passedTests, submitResult.totalTests)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Total Runtime</p>
                            <p className="mt-1 text-xl font-semibold text-slate-100">{submitResult.totalExecutionTimeMs} ms</p>
                        </div>
                        <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Avg / Test</p>
                            <p className="mt-1 text-xl font-semibold text-slate-100">
                                {submitResult.totalTests > 0
                                    ? `${Math.floor(submitResult.totalExecutionTimeMs / submitResult.totalTests)} ms`
                                    : "0 ms"}
                            </p>
                        </div>
                        <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Peak Memory</p>
                            <p className="mt-1 text-xl font-semibold text-slate-100">{formatMemoryMb(submitResult.peakMemoryUsedMb)}</p>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span>Solved: {submitResult.solved ? "Yes" : "No"}</span>
                        <span>Best Score: {submitResult.bestScore}%</span>
                    </div>
                </div>

                <div className="mt-4 space-y-3">
                    {submitResult.testResults.map((testResult) => (
                        testResult.hidden
                            ? <SubmitResultCaseCard key={testResult.testNumber} testResult={testResult} />
                            : <RunResultCaseCard
                                key={testResult.testNumber}
                                testResult={mapSubmitVisibleResultToRunResult(testResult)}
                            />
                    ))}
                </div>
            </div>
        );
    }

    const runResult = result;
    return (
        <div className="h-full min-h-0 overflow-y-auto p-4">
            <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-[0_10px_30px_rgba(2,6,23,0.3)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Run Summary</p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-100">
                            {runResult.challengeSlug}
                            {languageLabel ? ` · ${languageLabel}` : ""}
                        </h3>
                    </div>
                    <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusClasses(runResult.status)}`}
                    >
                        {runResult.status}
                    </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Passed</p>
                        <p className="mt-1 text-xl font-semibold text-emerald-300">{runResult.passedTests}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Failed</p>
                        <p className="mt-1 text-xl font-semibold text-rose-300">{runResult.failedTests}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Pass Rate</p>
                        <p className="mt-1 text-xl font-semibold text-sky-300">
                            {getPassRate(runResult.passedTests, runResult.totalTests)}
                        </p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Total Runtime</p>
                        <p className="mt-1 text-xl font-semibold text-slate-100">{runResult.totalExecutionTimeMs} ms</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Avg / Test</p>
                        <p className="mt-1 text-xl font-semibold text-slate-100">{runResult.averageExecutionTimeMs} ms</p>
                    </div>
                    <div className="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Peak Memory</p>
                        <p className="mt-1 text-xl font-semibold text-slate-100">{formatMemoryMb(runResult.peakMemoryUsedMb)}</p>
                    </div>
                </div>

                <div className="mt-3 text-xs text-slate-400">
                    Limits: {runResult.timeLimitMs} ms per test · {runResult.memoryLimitMb} MB memory cap
                </div>
            </div>

            <div className="mt-4 space-y-3">
                {runResult.testResults.map((testResult) => (
                    <RunResultCaseCard key={testResult.testNumber} testResult={testResult} />
                ))}
            </div>
        </div>
    );
}

export default RunResultsPanel;
