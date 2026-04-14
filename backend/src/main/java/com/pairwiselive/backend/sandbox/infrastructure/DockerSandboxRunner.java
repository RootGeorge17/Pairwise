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
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DockerSandboxRunner implements SandboxRunner {

    private static final Logger log = LoggerFactory.getLogger(DockerSandboxRunner.class);
    private static final String SANDBOX_CONTAINER_USER = "10001:10001";

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
            ExecutorService readerExecutor = Executors.newFixedThreadPool(2);
            Future<StreamReadResult> stdoutFuture = null;
            Future<StreamReadResult> stderrFuture = null;

            try {
                stdoutFuture = readerExecutor.submit(() -> InputStreamUtils.readCapped(
                    process.getInputStream(),
                    sandboxProperties.getMaxOutputBytes()
                ));
                stderrFuture = readerExecutor.submit(() -> InputStreamUtils.readCapped(
                    process.getErrorStream(),
                    sandboxProperties.getMaxOutputBytes()
                ));

                boolean finished = process.waitFor(
                    request.timeLimitMs() + sandboxProperties.getExtraTimeoutBufferMs(),
                    TimeUnit.MILLISECONDS
                );

                if (!finished) {
                    process.destroyForcibly();
                    StreamReadResult stdoutRead = awaitStreamRead(stdoutFuture);
                    StreamReadResult stderrRead = awaitStreamRead(stderrFuture);
                    long duration = Duration.between(start, Instant.now()).toMillis();
                    return new SandboxExecutionResult(
                        false,
                        true,
                        SandboxExecutionStatus.TIMEOUT,
                        stdoutRead.content(),
                        appendTimeoutMessage(stderrRead.content()),
                        null,
                        duration,
                        stdoutRead.truncated(),
                        stderrRead.truncated()
                    );
                }

                StreamReadResult stdoutRead = awaitStreamRead(stdoutFuture);
                StreamReadResult stderrRead = awaitStreamRead(stderrFuture);
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
            } finally {
                readerExecutor.shutdownNow();
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Sandbox execution interrupted", e);
            long duration = Duration.between(start, Instant.now()).toMillis();
            return new SandboxExecutionResult(
                false,
                false,
                SandboxExecutionStatus.SANDBOX_ERROR,
                "",
                "Sandbox execution was interrupted.",
                null,
                duration,
                false,
                false
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

    private StreamReadResult awaitStreamRead(
        Future<StreamReadResult> streamReadFuture
    ) throws InterruptedException, ExecutionException {
        if (streamReadFuture == null) {
            return new StreamReadResult("", false);
        }
        return streamReadFuture.get();
    }

    private String appendTimeoutMessage(
        String stderr
    ) {
        String timeoutMessage = "Execution exceeded time limit.";
        if (stderr == null || stderr.isBlank()) {
            return timeoutMessage;
        }
        return stderr + System.lineSeparator() + timeoutMessage;
    }

    private List<String> buildDockerCommand(
        Path workspace, 
        SandboxExecutionRequest request
    ) {
        return List.of(
            "docker", "run", "--rm",
            "--network", "none",
            "--user", SANDBOX_CONTAINER_USER,
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
