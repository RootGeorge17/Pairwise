import { useEffect, useState } from "react";
import { fetchChallengeBySlug, getErrorMessage } from "../lib/challengesApi";
import type { ChallengeDetails } from "../types/challenge";

function formatDifficulty(difficulty: string): string {
    return difficulty.charAt(0) + difficulty.slice(1).toLowerCase();
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

function toParagraphs(text: string): string[] {
    return text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.length > 0);
}

function toConstraintLines(text: string): string[] {
    return text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

type ChallengePanelProps = {
    slug: string;
};

function ChallengePanel({ slug }: ChallengePanelProps) {
    const [challenge, setChallenge] = useState<ChallengeDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const loadChallenge = async () => {
            setIsLoading(true);
            setErrorMessage(null);

            try {
                const details = await fetchChallengeBySlug(slug, controller.signal);
                setChallenge(details);
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }
                setChallenge(null);
                setErrorMessage(getErrorMessage(error, "Failed to load challenge details."));
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        void loadChallenge();

        return () => controller.abort();
    }, [slug]);

    return (
        <div className="space-y-5 text-slate-200">
            <div className="sticky top-0 z-10 -mx-1 border-b border-slate-700/80 bg-slate-900/90 px-1 pb-4 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Problem</p>
                        <h2 className="mt-1 text-2xl font-semibold text-slate-100">
                            {challenge ? challenge.title : "Challenge"}
                        </h2>
                    </div>

                    {challenge && (
                        <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getDifficultyClasses(challenge.difficulty)}`}
                        >
                            {formatDifficulty(challenge.difficulty)}
                        </span>
                    )}
                </div>
            </div>

            {isLoading && (
                <div className="space-y-3 animate-pulse">
                    <div className="h-5 w-3/4 rounded bg-slate-700/70" />
                    <div className="h-4 w-full rounded bg-slate-800/70" />
                    <div className="h-4 w-11/12 rounded bg-slate-800/70" />
                    <div className="h-4 w-4/5 rounded bg-slate-800/70" />
                </div>
            )}

            {errorMessage && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    Error loading challenge details: {errorMessage}
                </div>
            )}

            {challenge && !isLoading && !errorMessage && (
                <>
                    <section className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.35)]">
                        <h3 className="mb-3 text-base font-semibold text-slate-100">Description</h3>
                        <div className="space-y-3 text-sm leading-7 text-slate-300">
                            {toParagraphs(challenge.description).map((paragraph, index) => (
                                <p key={`${challenge.id}-paragraph-${index}`} className="whitespace-pre-line">
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h3 className="text-base font-semibold text-slate-100">Examples</h3>
                        {challenge.examples.map((example, index) => (
                            <article
                                key={example.id}
                                className="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/70"
                            >
                                <header className="border-b border-slate-700/70 bg-slate-800/70 px-4 py-2 text-sm font-medium text-slate-200">
                                    Example {index + 1}
                                </header>
                                <div className="space-y-3 p-4">
                                    <div>
                                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Input</p>
                                        <pre className="overflow-x-auto rounded-md bg-slate-950/70 p-3 text-xs text-slate-200 whitespace-pre-wrap">
                                            {example.input}
                                        </pre>
                                    </div>
                                    <div>
                                        <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Output</p>
                                        <pre className="overflow-x-auto rounded-md bg-slate-950/70 p-3 text-xs text-slate-200 whitespace-pre-wrap">
                                            {example.output}
                                        </pre>
                                    </div>
                                    {example.explenationText && (
                                        <div>
                                            <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                                                Explanation
                                            </p>
                                            <p className="text-sm leading-6 text-slate-300 whitespace-pre-wrap">
                                                {example.explenationText}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}
                    </section>

                    {challenge.constraintsText && (
                        <section className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-5">
                            <h3 className="mb-3 text-base font-semibold text-slate-100">Constraints</h3>
                            <ul className="space-y-2 text-sm text-slate-300">
                                {toConstraintLines(challenge.constraintsText).map((line, index) => (
                                    <li key={`${challenge.id}-constraint-${index}`} className="flex items-start gap-2">
                                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-500" />
                                        <span>{line}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {challenge.followUpText && (
                        <section className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-4 text-sm italic text-indigo-200">
                            Follow-up: {challenge.followUpText}
                        </section>
                    )}
                </>
            )}
        </div>
    );
}

export default ChallengePanel;
