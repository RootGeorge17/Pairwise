package com.pairwiselive.backend.sandbox.application;

import com.pairwiselive.backend.model.entity.ExecutionRun;
import com.pairwiselive.backend.model.enums.ExecutionRunStatus;
import com.pairwiselive.backend.model.enums.RunType;
import com.pairwiselive.backend.repository.ExecutionRunRepository;
import com.pairwiselive.backend.sandbox.api.dto.RunCodeResponse;
import com.pairwiselive.backend.sandbox.api.dto.RunTestCaseResult;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionStatus;
import com.pairwiselive.backend.sandbox.domain.SandboxRunStatus;
import com.pairwiselive.backend.sandbox.domain.SandboxTestStatus;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ExecutionRunRecorder {

    private final ExecutionRunRepository executionRunRepository;

    public ExecutionRun record(
        EvaluatedSandboxRun evaluatedSandboxRun,
        String sourceCode,
        RunType runType
    ) {
        ExecutionRun executionRun = Objects.requireNonNull(
            ExecutionRun.builder()
                .challenge(evaluatedSandboxRun.challenge())
                .challengeLanguage(evaluatedSandboxRun.challengeLanguage())
                .sourceCode(sourceCode)
                .runType(runType)
                .status(resolveExecutionRunStatus(evaluatedSandboxRun))
                .stdout(evaluatedSandboxRun.rawExecution().stdout())
                .stderr(evaluatedSandboxRun.rawExecution().stderr())
                .exitCode(evaluatedSandboxRun.rawExecution().exitCode())
                .executionTimeMs(toNullableInt(evaluatedSandboxRun.runResponse().totalExecutionTimeMs()))
                .memoryUsedMb(evaluatedSandboxRun.peakMemoryUsedMb())
                .build()
        );
        return executionRunRepository.save(executionRun);
    }

    private ExecutionRunStatus resolveExecutionRunStatus(
        EvaluatedSandboxRun evaluatedSandboxRun
    ) {
        SandboxExecutionStatus rawStatus = evaluatedSandboxRun.rawExecution().status();
        if (rawStatus == SandboxExecutionStatus.TIMEOUT) {
            return ExecutionRunStatus.TIMEOUT;
        }
        if (rawStatus == SandboxExecutionStatus.SANDBOX_ERROR) {
            return ExecutionRunStatus.SANDBOX_ERROR;
        }

        RunCodeResponse runResponse = evaluatedSandboxRun.runResponse();
        if (runResponse.status() == SandboxRunStatus.PASSED && runResponse.failedTests() == 0) {
            return ExecutionRunStatus.SUCCESS;
        }

        boolean hasWrongAnswer = false;
        boolean hasRuntimeError = false;
        boolean hasTimeout = false;
        boolean hasSandboxError = false;

        for (RunTestCaseResult testResult : runResponse.testResults()) {
            SandboxTestStatus testStatus = testResult.status();
            switch (testStatus) {
                case PASSED -> {
                    // No-op.
                }
                case WRONG_ANSWER -> hasWrongAnswer = true;
                case TIMEOUT -> hasTimeout = true;
                case RUNTIME_ERROR, OUTPUT_LIMIT_EXCEEDED -> hasRuntimeError = true;
                case SANDBOX_ERROR -> hasSandboxError = true;
            }
        }

        if (hasSandboxError) {
            return ExecutionRunStatus.SANDBOX_ERROR;
        }
        if (hasTimeout) {
            return ExecutionRunStatus.TIMEOUT;
        }
        if (hasRuntimeError || rawStatus == SandboxExecutionStatus.OUTPUT_LIMIT_EXCEEDED) {
            return ExecutionRunStatus.RUNTIME_ERROR;
        }
        if (hasWrongAnswer || runResponse.failedTests() > 0) {
            return ExecutionRunStatus.FAILED_WRONG_ANSWER;
        }
        if (rawStatus == SandboxExecutionStatus.SUCCESS) {
            return ExecutionRunStatus.SUCCESS;
        }
        return ExecutionRunStatus.RUNTIME_ERROR;
    }

    private Integer toNullableInt(
        Long value
    ) {
        if (value == null) {
            return null;
        }
        return value > Integer.MAX_VALUE ? Integer.MAX_VALUE : value.intValue();
    }
}
