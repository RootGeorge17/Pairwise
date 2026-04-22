export type RegisterRequest = {
    username: string;
    email: string;
    password: string;
    displayName: string;
};

export type LoginRequest = {
    email: string;
    password: string;
};

export type AuthResponse = {
    accessToken: string;
    refreshToken: string;
    userId: number;
    username: string;
    email: string;
    displayName: string;
    role: string;
};

export type MeResponse = {
    userId: number;
    username: string;
    email: string;
    displayName: string;
    role: string;
};

export type ApiFieldError = {
    field: string;
    message: string;
};

export type ApiErrorResponse = {
    status?: number;
    code?: string;
    message?: string;
    fieldErrors?: ApiFieldError[];
};
