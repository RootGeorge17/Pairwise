package com.pairwiselive.backend.sandbox.infrastructure;

import com.pairwiselive.backend.config.SandboxProperties;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionRequest;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionResult;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionStatus;
import com.pairwiselive.backend.sandbox.domain.SandboxRunner;
import com.pairwiselive.backend.util.io.DirectoryUtils;
import com.pairwiselive.backend.util.io.InputStreamUtils;
import com.pairwiselive.backend.util.io.StreamReadResult;
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
    private final SandboxProperties sandboxProperties;

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

            boolean finished = process.waitFor(
                request.timeLimitMs() + sandboxProperties.getExtraTimeoutBufferMs(),
                TimeUnit.MILLISECONDS
            );

            if (!finished) {
                process.destroyForcibly();
                long duration = Duration.between(start, Instant.now()).toMillis();
                return new SandboxExecutionResult(
                    false,
                    true,
                    SandboxExecutionStatus.TIMEOUT,
                    "",
                    "Execution exceeded time limit.",
                    null,
                    duration,
                    false,
                    false
                );
            }

            StreamReadResult stdoutRead = InputStreamUtils.readCapped(
                process.getInputStream(),
                sandboxProperties.getMaxOutputBytes()
            );
            StreamReadResult stderrRead = InputStreamUtils.readCapped(
                process.getErrorStream(),
                sandboxProperties.getMaxOutputBytes()
            );
            String stdout = stdoutRead.content();
            String stderr = stderrRead.content();
            int exitCode = process.exitValue();
            long duration = Duration.between(start, Instant.now()).toMillis();
            boolean outputTruncated = stdoutRead.truncated() || stderrRead.truncated();
            SandboxExecutionStatus status = outputTruncated
                ? SandboxExecutionStatus.OUTPUT_LIMIT_EXCEEDED
                : exitCode == 0 ? SandboxExecutionStatus.SUCCESS : SandboxExecutionStatus.RUNTIME_ERROR;

            return new SandboxExecutionResult(
                exitCode == 0 && !outputTruncated,
                false,
                status,
                stdout,
                stderr,
                exitCode,
                duration,
                stdoutRead.truncated(),
                stderrRead.truncated()
            );

        } catch (Exception e) {
            log.error("Sandbox execution failed", e);
            long duration = Duration.between(start, Instant.now()).toMillis();
            return new SandboxExecutionResult(
                false,
                false,
                SandboxExecutionStatus.SANDBOX_ERROR,
                "",
                e.getMessage(),
                null,
                duration,
                false,
                false
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
            "--cpus", sandboxProperties.getCpus(),
            "--memory", request.memoryLimitMb() + "m",
            "--pids-limit", String.valueOf(sandboxProperties.getPidsLimit()),
            "--read-only",
            "--tmpfs", sandboxProperties.getTmpfs(),
            "--security-opt", "no-new-privileges",
            "--cap-drop", "ALL",
            "-v", workspace.toAbsolutePath() + buildVolumeSuffix(),
            "-w", "/sandbox",
            request.dockerImage(),
            "node", "runner.js"
        );
    }

    private String buildVolumeSuffix() {
        return sandboxProperties.isEnableSelinuxLabel() ? ":/sandbox:ro,Z" : ":/sandbox:ro";
    }
}
