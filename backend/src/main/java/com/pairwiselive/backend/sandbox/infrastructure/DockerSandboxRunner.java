package com.pairwiselive.backend.sandbox.infrastructure;

import com.pairwiselive.backend.sandbox.domain.SandboxExecutionRequest;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionResult;
import com.pairwiselive.backend.sandbox.domain.SandboxRunner;
import com.pairwiselive.backend.util.io.DirectoryUtils;
import com.pairwiselive.backend.util.io.InputStreamUtils;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DockerSandboxRunner implements SandboxRunner {

    private static final Logger log = LoggerFactory.getLogger(DockerSandboxRunner.class);

    private final SandboxFilePreparer filePreparer;

    @Override
    public SandboxExecutionResult execute(
        SandboxExecutionRequest request
    ) {
        Path workspace = null;
        Instant start = Instant.now();

        try {
            workspace = filePreparer.prepareWorkspace(request);

            List<String> command = buildDockerCommand(workspace, request);
            log.debug("Executing sandbox command: {}", command);

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

            String stdout = InputStreamUtils.readAll(process.getInputStream());
            String stderr = InputStreamUtils.readAll(process.getErrorStream());
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
            log.error("Sandbox execution failed", e);
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
            DirectoryUtils.deleteDirectoryQuietly(workspace);
        }
    }

    private List<String> buildDockerCommand(
        Path workspace, 
        SandboxExecutionRequest request
    ) {
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
}
