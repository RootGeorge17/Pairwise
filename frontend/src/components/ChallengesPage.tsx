import { useEffect, useState } from "react";
import ChallengeList from "./ChallengeList";
import { fetchChallenges, getErrorMessage } from "../lib/challengesApi";
import type { ChallengeSummary } from "../types/challenge";

type ChallengesPageProps = {
    onOpenChallenge: (slug: string) => void;
};

function ChallengesPage({ onOpenChallenge }: ChallengesPageProps) {
    const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const loadChallenges = async () => {
            setIsLoading(true);
            setErrorMessage(null);

            try {
                const summaries = await fetchChallenges(controller.signal);
                setChallenges(summaries);
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }
                setChallenges([]);
                setErrorMessage(getErrorMessage(error, "Failed to load challenges."));
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        void loadChallenges();

        return () => controller.abort();
    }, []);

    return (
        <div className="h-full bg-gray-900 p-6 text-white">
            <div className="mx-auto max-w-3xl space-y-6">
                <header className="border-b border-gray-700 pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold">Challenges</h1>
                            <p className="mt-1 text-sm text-gray-400">
                                Browse all challenges and open one to see full details.
                            </p>
                        </div>

                    </div>
                </header>

                {isLoading && <p className="text-gray-300">Loading challenges...</p>}

                {errorMessage && (
                    <p className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-red-300">
                        Error loading challenges: {errorMessage}
                    </p>
                )}

                {!isLoading && !errorMessage && challenges.length === 0 && (
                    <p className="text-gray-300">No challenges found.</p>
                )}

                {!isLoading && !errorMessage && challenges.length > 0 && (
                    <ChallengeList
                        challenges={challenges}
                        selectedSlug={null}
                        onSelect={onOpenChallenge}
                    />
                )}
            </div>
        </div>
    );
}

export default ChallengesPage;
