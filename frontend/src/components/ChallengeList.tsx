import type { ChallengeSummary } from "../types/challenge";

type ChallengeListProps = {
    challenges: ChallengeSummary[];
    selectedSlug: string | null;
    onSelect: (slug: string) => void;
    disabled?: boolean;
};

function formatDifficulty(difficulty: string): string {
    return difficulty.charAt(0) + difficulty.slice(1).toLowerCase();
}

function ChallengeList({ challenges, selectedSlug, onSelect, disabled = false }: ChallengeListProps) {
    return (
        <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                All Challenges
            </h3>

            <div className="space-y-2">
                {challenges.map((challenge) => {
                    const isSelected = challenge.slug === selectedSlug;
                    return (
                        <button
                            key={challenge.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => onSelect(challenge.slug)}
                            className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                                isSelected
                                    ? "border-yellow-500 bg-yellow-500/10"
                                    : "border-gray-700 bg-gray-800 hover:border-gray-600"
                            } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
                        >
                            <p className="font-medium text-white">{challenge.title}</p>
                            <p className="text-xs text-gray-400">
                                {formatDifficulty(challenge.difficulty)}
                            </p>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

export default ChallengeList;
