package com.pairwiselive.backend.sandbox;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Set;

public class SandboxFilePreparer {

    public Path prepareWorkspace(SandboxExecutionRequest request) throws IOException {
        Path workspace = Files.createTempDirectory("pairwise-run-");

        Path solutionFile = workspace.resolve(request.entryFilename());
        Files.writeString(solutionFile, request.sourceCode(), StandardCharsets.UTF_8);

        Path runnerFile = workspace.resolve("runner.js");
        Files.writeString(runnerFile, buildRunnerScript(request), StandardCharsets.UTF_8);

        setPermissions(workspace, solutionFile, runnerFile);

        return workspace;
    }

    private void setPermissions(Path workspace, Path solutionFile, Path runnerFile) {
        try {
            Set<PosixFilePermission> dirPerms =
                PosixFilePermissions.fromString("rwxr-xr-x");   // 755
            Set<PosixFilePermission> filePerms =
                PosixFilePermissions.fromString("rw-r--r--");   // 644

            Files.setPosixFilePermissions(workspace, dirPerms);
            Files.setPosixFilePermissions(solutionFile, filePerms);
            Files.setPosixFilePermissions(runnerFile, filePerms);
        } catch (UnsupportedOperationException | IOException ignored) {
            // Ignore on non-POSIX file systems
        }
    }

    private String buildRunnerScript(SandboxExecutionRequest request) {
        return """
            const solution = require('./%s');
            const input = %s;

            async function main() {
              try {
                const fn = solution['%s'];
                if (typeof fn !== 'function') {
                  console.error('Expected function not found: %s');
                  process.exit(2);
                }

                const result = await fn(...Object.values(input));
                process.stdout.write(JSON.stringify(result));
              } catch (error) {
                console.error(error?.stack || String(error));
                process.exit(1);
              }
            }

            main();
            """.formatted(
                request.entryFilename(),
                request.inputJson(),
                request.expectedFunctionName(),
                request.expectedFunctionName()
            );
    }
}