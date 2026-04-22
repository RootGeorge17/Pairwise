import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ApiRequestError, persistAuthSession, register } from "../lib/authApi";

type RegisterPageProps = {
    onSuccess: () => void;
    onOpenLogin: () => void;
    onOpenChallenges: () => void;
};

type RegisterFormState = {
    username: string;
    displayName: string;
    email: string;
    password: string;
    confirmPassword: string;
};

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function RegisterPage({ onSuccess, onOpenLogin, onOpenChallenges }: RegisterPageProps) {
    const [formState, setFormState] = useState<RegisterFormState>({
        username: "",
        displayName: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterFormState, string>>>({});

    const canSubmit = useMemo(() => {
        return (
            !isSubmitting
            && formState.username.trim().length > 0
            && formState.displayName.trim().length > 0
            && formState.email.trim().length > 0
            && formState.password.length > 0
            && formState.confirmPassword.length > 0
        );
    }, [
        formState.confirmPassword.length,
        formState.displayName,
        formState.email,
        formState.password.length,
        formState.username,
        isSubmitting,
    ]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const trimmedUsername = formState.username.trim();
        const trimmedDisplayName = formState.displayName.trim();
        const trimmedEmail = formState.email.trim().toLowerCase();
        const nextFieldErrors: Partial<Record<keyof RegisterFormState, string>> = {};

        if (trimmedUsername.length === 0) {
            nextFieldErrors.username = "Username is required.";
        }

        if (trimmedDisplayName.length === 0) {
            nextFieldErrors.displayName = "Display name is required.";
        }

        if (trimmedEmail.length === 0) {
            nextFieldErrors.email = "Email is required.";
        } else if (!isValidEmail(trimmedEmail)) {
            nextFieldErrors.email = "Enter a valid email address.";
        }

        if (formState.password.length === 0) {
            nextFieldErrors.password = "Password is required.";
        } else if (formState.password.length < 8) {
            nextFieldErrors.password = "Password must be at least 8 characters.";
        }

        if (formState.confirmPassword.length === 0) {
            nextFieldErrors.confirmPassword = "Please confirm your password.";
        } else if (formState.confirmPassword !== formState.password) {
            nextFieldErrors.confirmPassword = "Passwords do not match.";
        }

        setFieldErrors(nextFieldErrors);
        setErrorMessage(null);

        if (Object.keys(nextFieldErrors).length > 0) {
            return;
        }

        try {
            setIsSubmitting(true);
            const authResponse = await register({
                username: trimmedUsername,
                displayName: trimmedDisplayName,
                email: trimmedEmail,
                password: formState.password,
            });
            persistAuthSession(authResponse);
            onSuccess();
        } catch (error) {
            if (error instanceof ApiRequestError) {
                setFieldErrors({
                    username: error.fieldErrors.username,
                    displayName: error.fieldErrors.displayName,
                    email: error.fieldErrors.email,
                    password: error.fieldErrors.password,
                });
                setErrorMessage(error.message);
                return;
            }

            setErrorMessage(error instanceof Error ? error.message : "Unable to create account right now.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-full text-slate-100">
            <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center p-4 sm:p-6">
                <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/85 shadow-[0_24px_60px_rgba(2,6,23,0.5)] md:grid-cols-[1.05fr_1fr]">
                    <section className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900/70 p-8 md:flex">
                        <div className="space-y-3">
                            <p className="text-xs uppercase tracking-[0.28em] text-emerald-300">Pairwise Live</p>
                            <h1 className="text-3xl font-semibold leading-tight text-slate-100">
                                Create your account and start solving challenges.
                            </h1>
                            <p className="text-sm leading-7 text-slate-300">
                                Join collaborative coding sessions, run secure test executions, and track your progress.
                            </p>
                        </div>
                    </section>

                    <section className="p-6 sm:p-8">
                        <header className="mb-6 space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Authentication</p>
                            <h2 className="text-2xl font-semibold text-slate-100">Create account</h2>
                            <p className="text-sm text-slate-300">
                                Set up your profile details to get started.
                            </p>
                        </header>

                        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label htmlFor="register-username" className="text-sm font-medium text-slate-200">
                                        Username
                                    </label>
                                    <input
                                        id="register-username"
                                        type="text"
                                        autoComplete="username"
                                        value={formState.username}
                                        onChange={(event) => {
                                            setFormState((previous) => ({ ...previous, username: event.target.value }));
                                            setFieldErrors((previous) => ({ ...previous, username: undefined }));
                                        }}
                                        className="w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                                        placeholder="yourhandle"
                                        disabled={isSubmitting}
                                    />
                                    {fieldErrors.username && <p className="text-xs text-rose-300">{fieldErrors.username}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="register-display-name" className="text-sm font-medium text-slate-200">
                                        Display name
                                    </label>
                                    <input
                                        id="register-display-name"
                                        type="text"
                                        autoComplete="name"
                                        value={formState.displayName}
                                        onChange={(event) => {
                                            setFormState((previous) => ({ ...previous, displayName: event.target.value }));
                                            setFieldErrors((previous) => ({ ...previous, displayName: undefined }));
                                        }}
                                        className="w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                                        placeholder="Ada Lovelace"
                                        disabled={isSubmitting}
                                    />
                                    {fieldErrors.displayName && <p className="text-xs text-rose-300">{fieldErrors.displayName}</p>}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="register-email" className="text-sm font-medium text-slate-200">
                                    Email
                                </label>
                                <input
                                    id="register-email"
                                    type="email"
                                    autoComplete="email"
                                    value={formState.email}
                                    onChange={(event) => {
                                        setFormState((previous) => ({ ...previous, email: event.target.value }));
                                        setFieldErrors((previous) => ({ ...previous, email: undefined }));
                                    }}
                                    className="w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                                    placeholder="you@example.com"
                                    disabled={isSubmitting}
                                />
                                {fieldErrors.email && <p className="text-xs text-rose-300">{fieldErrors.email}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="register-password" className="text-sm font-medium text-slate-200">
                                    Password
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/20">
                                    <input
                                        id="register-password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="new-password"
                                        value={formState.password}
                                        onChange={(event) => {
                                            setFormState((previous) => ({ ...previous, password: event.target.value }));
                                            setFieldErrors((previous) => ({ ...previous, password: undefined }));
                                        }}
                                        className="w-full bg-transparent py-2.5 text-sm text-slate-100 outline-none"
                                        placeholder="Minimum 8 characters"
                                        disabled={isSubmitting}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((previous) => !previous)}
                                        className="text-xs font-medium text-slate-300 hover:text-slate-100"
                                    >
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                                {fieldErrors.password && <p className="text-xs text-rose-300">{fieldErrors.password}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="register-confirm-password" className="text-sm font-medium text-slate-200">
                                    Confirm password
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/20">
                                    <input
                                        id="register-confirm-password"
                                        type={showConfirmPassword ? "text" : "password"}
                                        autoComplete="new-password"
                                        value={formState.confirmPassword}
                                        onChange={(event) => {
                                            setFormState((previous) => ({ ...previous, confirmPassword: event.target.value }));
                                            setFieldErrors((previous) => ({ ...previous, confirmPassword: undefined }));
                                        }}
                                        className="w-full bg-transparent py-2.5 text-sm text-slate-100 outline-none"
                                        placeholder="Re-enter password"
                                        disabled={isSubmitting}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword((previous) => !previous)}
                                        className="text-xs font-medium text-slate-300 hover:text-slate-100"
                                    >
                                        {showConfirmPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                                {fieldErrors.confirmPassword && (
                                    <p className="text-xs text-rose-300">{fieldErrors.confirmPassword}</p>
                                )}
                            </div>

                            {errorMessage && (
                                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                                    {errorMessage}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                            >
                                {isSubmitting ? "Creating account..." : "Create account"}
                            </button>
                        </form>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                            <button
                                type="button"
                                onClick={onOpenLogin}
                                className="text-emerald-300 transition hover:text-emerald-200"
                            >
                                Already have an account? Sign in
                            </button>
                            <button
                                type="button"
                                onClick={onOpenChallenges}
                                className="text-slate-400 transition hover:text-slate-300"
                            >
                                Continue as guest
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

export default RegisterPage;
