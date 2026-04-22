import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ApiRequestError, login, persistAuthSession } from "../lib/authApi";

type LoginPageProps = {
    onSuccess: () => void;
    onOpenRegister: () => void;
    onOpenChallenges: () => void;
};

type LoginFormState = {
    email: string;
    password: string;
};

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function LoginPage({ onSuccess, onOpenRegister, onOpenChallenges }: LoginPageProps) {
    const [formState, setFormState] = useState<LoginFormState>({
        email: "",
        password: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginFormState, string>>>({});

    const canSubmit = useMemo(() => {
        return !isSubmitting && formState.email.trim().length > 0 && formState.password.length > 0;
    }, [formState.email, formState.password.length, isSubmitting]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const trimmedEmail = formState.email.trim().toLowerCase();
        const nextFieldErrors: Partial<Record<keyof LoginFormState, string>> = {};

        if (trimmedEmail.length === 0) {
            nextFieldErrors.email = "Email is required.";
        } else if (!isValidEmail(trimmedEmail)) {
            nextFieldErrors.email = "Enter a valid email address.";
        }

        if (formState.password.length === 0) {
            nextFieldErrors.password = "Password is required.";
        }

        setFieldErrors(nextFieldErrors);
        setErrorMessage(null);

        if (Object.keys(nextFieldErrors).length > 0) {
            return;
        }

        try {
            setIsSubmitting(true);
            const authResponse = await login({
                email: trimmedEmail,
                password: formState.password,
            });
            persistAuthSession(authResponse);
            onSuccess();
        } catch (error) {
            if (error instanceof ApiRequestError) {
                setFieldErrors({
                    email: error.fieldErrors.email,
                    password: error.fieldErrors.password,
                });
                setErrorMessage(error.message);
                return;
            }

            setErrorMessage(error instanceof Error ? error.message : "Unable to sign in right now.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-full text-slate-100">
            <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center p-4 sm:p-6">
                <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/85 shadow-[0_24px_60px_rgba(2,6,23,0.5)] md:grid-cols-[1.1fr_1fr]">
                    <section className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900/70 p-8 md:flex">
                        <div className="space-y-3">
                            <p className="text-xs uppercase tracking-[0.28em] text-sky-300">Pairwise Live</p>
                            <h1 className="text-3xl font-semibold leading-tight text-slate-100">
                                Sign in and continue your coding session.
                            </h1>
                            <p className="text-sm leading-7 text-slate-300">
                                Access collaborative coding, run tests, and submit solutions with your account.
                            </p>
                        </div>
                    </section>

                    <section className="p-6 sm:p-8">
                        <header className="mb-6 space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Authentication</p>
                            <h2 className="text-2xl font-semibold text-slate-100">Welcome back</h2>
                            <p className="text-sm text-slate-300">
                                Enter your credentials to access your account.
                            </p>
                        </header>

                        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                            <div className="space-y-1.5">
                                <label htmlFor="login-email" className="text-sm font-medium text-slate-200">
                                    Email
                                </label>
                                <input
                                    id="login-email"
                                    type="email"
                                    autoComplete="email"
                                    value={formState.email}
                                    onChange={(event) => {
                                        setFormState((previous) => ({ ...previous, email: event.target.value }));
                                        setFieldErrors((previous) => ({ ...previous, email: undefined }));
                                    }}
                                    className="w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                                    placeholder="you@example.com"
                                    disabled={isSubmitting}
                                />
                                {fieldErrors.email && <p className="text-xs text-rose-300">{fieldErrors.email}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="login-password" className="text-sm font-medium text-slate-200">
                                    Password
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-slate-600/80 bg-slate-950/70 px-3 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/20">
                                    <input
                                        id="login-password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        value={formState.password}
                                        onChange={(event) => {
                                            setFormState((previous) => ({ ...previous, password: event.target.value }));
                                            setFieldErrors((previous) => ({ ...previous, password: undefined }));
                                        }}
                                        className="w-full bg-transparent py-2.5 text-sm text-slate-100 outline-none"
                                        placeholder="Enter your password"
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

                            {errorMessage && (
                                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                                    {errorMessage}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="w-full rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                            >
                                {isSubmitting ? "Signing in..." : "Sign in"}
                            </button>
                        </form>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                            <button
                                type="button"
                                onClick={onOpenRegister}
                                className="text-sky-300 transition hover:text-sky-200"
                            >
                                Create an account
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

export default LoginPage;
