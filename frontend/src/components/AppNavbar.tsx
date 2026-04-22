import { useMemo, useState } from "react";
import {
    LayoutGrid,
    ListChecks,
    LogIn,
    LogOut,
    Menu,
    Sparkles,
    UserPlus,
    Users,
    X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type AppNavbarProps = {
    pathname: string;
    isAuthenticated: boolean;
    displayName: string | null;
    onNavigate: (to: string) => void;
    onLogout: () => void;
};

type NavLink = {
    label: string;
    to: string | null;
    icon: LucideIcon;
    soon?: boolean;
};

const NAV_LINKS: NavLink[] = [
    { label: "Challenges", to: "/challenges", icon: LayoutGrid },
    { label: "Submissions", to: null, icon: ListChecks, soon: true },
    { label: "Lobbies", to: null, icon: Users, soon: true },
];

function isActiveRoute(pathname: string, to: string | null): boolean {
    if (!to) {
        return false;
    }

    if (to === "/challenges") {
        return pathname === "/" || pathname === "/challenges" || pathname.startsWith("/challenges/");
    }

    return pathname === to || pathname.startsWith(`${to}/`);
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
    if (parts.length === 0) {
        return "PW";
    }
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function AppNavbar({ pathname, isAuthenticated, displayName, onNavigate, onLogout }: AppNavbarProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const safeDisplayName = displayName?.trim() || "Pairwise User";
    const compactDisplayName = useMemo(() => {
        if (safeDisplayName.length <= 24) {
            return safeDisplayName;
        }

        return `${safeDisplayName.slice(0, 24)}...`;
    }, [safeDisplayName]);
    const userInitials = useMemo(() => getInitials(safeDisplayName), [safeDisplayName]);

    const closeMobileMenu = () => setIsMobileMenuOpen(false);
    const navigateAndCloseMenu = (to: string) => {
        onNavigate(to);
        closeMobileMenu();
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-800/60 bg-slate-950/75 backdrop-blur-xl">
            <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-8">
                <div className="flex items-center gap-8">
                    <button
                        type="button"
                        onClick={() => onNavigate("/challenges")}
                        className="flex items-center gap-2.5 transition-opacity hover:opacity-85"
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-300/30 bg-sky-500/90 shadow-[0_6px_18px_rgba(56,189,248,0.3)]">
                            <Sparkles className="h-5 w-5 text-slate-950" strokeWidth={2.5} />
                        </div>
                        <span className="text-sm font-bold tracking-tight text-white">Pairwise</span>
                    </button>

                    <nav className="hidden items-center gap-1 md:flex">
                        {NAV_LINKS.map((link) => {
                            const active = isActiveRoute(pathname, link.to);
                            const disabled = !link.to;
                            const Icon = link.icon;

                            return (
                                <button
                                    key={link.label}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => link.to && onNavigate(link.to)}
                                    className={`group inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                                        active
                                            ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                                            : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900/70 hover:text-slate-100"
                                    } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
                                >
                                    <Icon className={`h-4 w-4 ${active ? "text-sky-300" : "text-slate-400 group-hover:text-slate-200"}`} />
                                    {link.label}
                                    {link.soon && (
                                        <span className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                            Soon
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="hidden items-center gap-4 md:flex">
                    {isAuthenticated ? (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/75 py-1 pl-1 pr-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.1)]">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-sky-300/30 bg-sky-500/20 text-[10px] font-semibold text-sky-100">
                                    {userInitials}
                                </div>
                                <span className="max-w-[170px] truncate text-sm font-medium text-slate-200">{compactDisplayName}</span>
                            </div>
                            <button
                                type="button"
                                onClick={onLogout}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/75 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:border-rose-300/40 hover:bg-rose-500/10 hover:text-rose-100"
                            >
                                <LogOut className="h-4 w-4" />
                                <span>Sign out</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/75 p-1 shadow-[inset_0_1px_0_rgba(148,163,184,0.1)]">
                            <button
                                type="button"
                                onClick={() => onNavigate("/login")}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800/80 hover:text-white"
                            >
                                <LogIn className="h-4 w-4" />
                                Sign in
                            </button>
                            <button
                                type="button"
                                onClick={() => onNavigate("/register")}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-3.5 py-1.5 text-sm font-semibold text-slate-950 shadow-[0_8px_20px_rgba(56,189,248,0.3)] transition hover:brightness-110"
                            >
                                <UserPlus className="h-4 w-4" />
                                Register
                            </button>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300 transition hover:border-slate-600 md:hidden"
                    aria-label="Toggle navigation menu"
                >
                    {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {isMobileMenuOpen && (
                <div className="absolute inset-x-0 top-full border-b border-slate-800 bg-slate-950 p-4 md:hidden">
                    <div className="space-y-1">
                        {NAV_LINKS.map((link) => {
                            const Icon = link.icon;
                            const active = isActiveRoute(pathname, link.to);
                            const disabled = !link.to;

                            return (
                                <button
                                    key={link.label}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => link.to && navigateAndCloseMenu(link.to)}
                                    className={`flex w-full items-center justify-between rounded-lg p-3 text-left text-sm font-medium transition ${
                                        active
                                            ? "bg-sky-500/15 text-sky-100"
                                            : "text-slate-300 hover:bg-slate-900 hover:text-slate-100"
                                    } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <Icon className="h-4 w-4" />
                                        {link.label}
                                    </span>
                                    {link.soon && (
                                        <span className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                            Soon
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 border-t border-slate-800 pt-4">
                        {isAuthenticated ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-sky-300/30 bg-sky-500/20 text-[10px] font-semibold text-sky-100">
                                        {userInitials}
                                    </div>
                                    <span className="truncate text-sm font-medium text-slate-200">{compactDisplayName}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onLogout();
                                        closeMobileMenu();
                                    }}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/75 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-rose-300/40 hover:bg-rose-500/10 hover:text-rose-100"
                                >
                                    <LogOut className="h-4 w-4" />
                                    Sign out
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => navigateAndCloseMenu("/login")}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/75 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                                >
                                    <LogIn className="h-4 w-4" />
                                    Sign in
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigateAndCloseMenu("/register")}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 shadow-[0_8px_20px_rgba(56,189,248,0.25)] transition hover:brightness-110"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    Register
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}

export default AppNavbar;
