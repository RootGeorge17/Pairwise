import { useEffect, useMemo, useRef, useState } from "react";
import MonacoEditor from "./components/MonacoEditor.tsx";
import ChallengePanel from "./components/ChallengePanel.tsx";
import ChallengesPage from "./components/ChallengesPage.tsx";

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

    useEffect(() => {
        const handlePopState = () => {
            setPathname(normalizePathname(window.location.pathname));
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
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

    if (pathname === "/" || pathname === "/challenges") {
        return (
            <ChallengesPage
                onOpenChallenge={(challengeSlug) =>
                    navigate(`/challenges/${encodeURIComponent(challengeSlug)}`)
                }
            />
        );
    }

    if (slug) {
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

        return (
            <div className="h-dvh w-screen overflow-hidden bg-[#070d1a] text-slate-100">
                <div className="h-full w-full p-2">
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
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6 text-white">
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

export default App;
