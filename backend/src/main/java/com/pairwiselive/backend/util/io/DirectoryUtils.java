package com.pairwiselive.backend.util.io;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;

public final class DirectoryUtils {

    private DirectoryUtils() {
    }

    public static void deleteDirectoryQuietly(
        Path path
    ) {
        if (path == null) {
            return;
        }

        try (var walk = Files.walk(path)) {
            walk.sorted(Comparator.reverseOrder())
                .forEach(currentPath -> {
                    try {
                        Files.deleteIfExists(currentPath);
                    } catch (IOException ignored) {
                    }
                });
        } catch (IOException ignored) {
        }
    }
}
