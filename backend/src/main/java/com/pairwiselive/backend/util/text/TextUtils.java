package com.pairwiselive.backend.util.text;

public final class TextUtils {

    private TextUtils() {
    }

    public static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    public static String normalizeToEmptyTrimmed(String value) {
        return value == null ? "" : value.trim();
    }
}
