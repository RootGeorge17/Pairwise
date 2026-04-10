package com.pairwiselive.backend.sandbox;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

@Component
public class DockerSandboxRunner implements SandboxRunner {

    private final SandboxFilePreparer filePreparer = new SandboxFilePreparer();

    @Override
    public SandboxExecutionResult execute(SandboxExecutionRequest request) {
        Path workspace = null;
        Instant start = Instant.now();

        try {
            workspace = filePreparer.prepareWorkspace(request);

            System.out.println("Workspace: " + workspace.toAbsolutePath());
            try (var paths = java.nio.file.Files.list(workspace)) {
                paths.forEach(path -> System.out.println(" - " + path.getFileName()));
            }

            List<String> command = buildDockerCommand(workspace, request);

            ProcessBuilder processBuilder = new ProcessBuilder(command);
            Process process = processBuilder.start();

            boolean finished = process.waitFor(request.timeLimitMs() + 1000L, TimeUnit.MILLISECONDS);

            if (!finished) {
                process.destroyForcibly();
                long duration = Duration.between(start, Instant.now()).toMillis();
                return new SandboxExecutionResult(
                    false,
                    true,
                    "TIMEOUT",
                    "",
                    "Execution exceeded time limit.",
                    null,
                    duration
                );
            }

            String stdout = readAll(process.getInputStream());
            String stderr = readAll(process.getErrorStream());
            int exitCode = process.exitValue();

            long duration = Duration.between(start, Instant.now()).toMillis();

            String status = exitCode == 0 ? "SUCCESS" : "RUNTIME_ERROR";

            return new SandboxExecutionResult(
                exitCode == 0,
                false,
                status,
                stdout,
                stderr,
                exitCode,
                duration
            );

        } catch (Exception e) {
            long duration = Duration.between(start, Instant.now()).toMillis();
            return new SandboxExecutionResult(
                false,
                false,
                "SANDBOX_ERROR",
                "",
                e.getMessage(),
                null,
                duration
            );
        } finally {
            if (workspace != null) {
                deleteDirectoryQuietly(workspace);
            }
        }
    }

    private List<String> buildDockerCommand(Path workspace, SandboxExecutionRequest request) {
        return List.of(
            "docker", "run", "--rm",
            "--network", "none",
            "--cpus", "0.5",
            "--memory", request.memoryLimitMb() + "m",
            "--pids-limit", "64",
            "--read-only",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
            "--security-opt", "no-new-privileges",
            "--cap-drop", "ALL",
            "-v", workspace.toAbsolutePath() + ":/sandbox:ro,Z",
            "-w", "/sandbox",
            request.dockerImage(),
            "node", "runner.js"
        );
    }

    private String readAll(InputStream inputStream) throws IOException {
        return new String(inputStream.readAllBytes());
    }

    private void deleteDirectoryQuietly(Path path) {
        try (var walk = java.nio.file.Files.walk(path)) {
            walk.sorted(java.util.Comparator.reverseOrder())
                .forEach(p -> {
                    try {
                        java.nio.file.Files.deleteIfExists(p);
                    } catch (IOException ignored) {
                    }
                });
        } catch (IOException ignored) {
        }
    }
}