package com.pairwiselive.backend.util.io;

import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

public final class InputStreamUtils {

    private InputStreamUtils() {
    }

    public static StreamReadResult readCapped(
        InputStream inputStream,
        int maxBytes
    ) throws IOException {
        if (maxBytes <= 0) {
            throw new IllegalArgumentException("maxBytes must be greater than 0.");
        }

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream(Math.min(maxBytes, 8192));
        byte[] buffer = new byte[4096];

        int totalRead = 0;
        boolean truncated = false;
        int bytesRead;

        while ((bytesRead = inputStream.read(buffer)) != -1) {
            if (totalRead < maxBytes) {
                int writable = Math.min(bytesRead, maxBytes - totalRead);
                if (writable > 0) {
                    outputStream.write(buffer, 0, writable);
                    totalRead += writable;
                }
                if (writable < bytesRead) {
                    truncated = true;
                }
            } else {
                truncated = true;
            }
        }

        return new StreamReadResult(outputStream.toString(StandardCharsets.UTF_8), truncated);
    }
}
