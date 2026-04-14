package com.pairwiselive.backend.util.io;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public final class InputStreamUtils {

    private InputStreamUtils() {
    }

    public static String readAll(
        InputStream inputStream
    ) throws IOException {
        return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
    }
}
