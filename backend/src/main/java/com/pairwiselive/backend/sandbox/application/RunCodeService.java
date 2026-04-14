package com.pairwiselive.backend.sandbox.application;

import com.pairwiselive.backend.model.enums.RunType;
import com.pairwiselive.backend.sandbox.api.dto.RunCodeRequest;
import com.pairwiselive.backend.sandbox.api.dto.RunCodeResponse;
import com.pairwiselive.backend.sandbox.application.SandboxTestCaseSelector.SelectionPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RunCodeService {

    private final SandboxBatchExecutionService sandboxBatchExecutionService;
    private final ExecutionRunRecorder executionRunRecorder;

    @Transactional
    public RunCodeResponse runCode(
        RunCodeRequest request
    ) {
        EvaluatedSandboxRun evaluatedSandboxRun = sandboxBatchExecutionService.evaluate(
            request.slug(),
            request.language(),
            request.sourceCode(),
            SelectionPolicy.RUN_VISIBLE_ONLY
        );

        executionRunRecorder.record(
            evaluatedSandboxRun,
            request.sourceCode(),
            RunType.RUN
        );

        return evaluatedSandboxRun.runResponse();
    }
}
