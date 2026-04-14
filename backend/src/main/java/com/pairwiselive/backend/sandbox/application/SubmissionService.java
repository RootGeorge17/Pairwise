package com.pairwiselive.backend.sandbox.application;

import com.pairwiselive.backend.exception.BadRequestException;
import com.pairwiselive.backend.exception.ResourceNotFoundException;
import com.pairwiselive.backend.model.entity.Submission;
import com.pairwiselive.backend.model.entity.SubmissionTestResult;
import com.pairwiselive.backend.model.entity.TestCase;
import com.pairwiselive.backend.model.entity.User;
import com.pairwiselive.backend.model.entity.UserChallengeProgress;
import com.pairwiselive.backend.model.enums.RunType;
import com.pairwiselive.backend.model.enums.SubmissionStatus;
import com.pairwiselive.backend.model.enums.SubmissionType;
import com.pairwiselive.backend.repository.SubmissionRepository;
import com.pairwiselive.backend.repository.SubmissionTestResultRepository;
import com.pairwiselive.backend.repository.UserRepository;
import com.pairwiselive.backend.sandbox.api.dto.RunCodeResponse;
import com.pairwiselive.backend.sandbox.api.dto.RunTestCaseResult;
import com.pairwiselive.backend.sandbox.api.dto.SubmitCodeRequest;
import com.pairwiselive.backend.sandbox.api.dto.SubmitCodeResponse;
import com.pairwiselive.backend.sandbox.api.dto.SubmitTestCaseResult;
import com.pairwiselive.backend.sandbox.application.SandboxTestCaseSelector.SelectionPolicy;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionStatus;
import com.pairwiselive.backend.sandbox.domain.SandboxRunStatus;
import com.pairwiselive.backend.sandbox.domain.SandboxTestStatus;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SubmissionService {

    private final SandboxBatchExecutionService sandboxBatchExecutionService;
    private final ExecutionRunRecorder executionRunRecorder;
    private final UserRepository userRepository;
    private final SubmissionRepository submissionRepository;
    private final SubmissionTestResultRepository submissionTestResultRepository;
    private final ProgressTrackingService progressTrackingService;

    @Transactional
    public SubmitCodeResponse submitCode(
        SubmitCodeRequest request,
        Long userId
    ) {
        if (userId == null || userId <= 0) {
            throw new BadRequestException("X-User-Id header is required and must be a positive number.");
        }

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        EvaluatedSandboxRun evaluatedSandboxRun = sandboxBatchExecutionService.evaluate(
            request.slug(),
            request.language(),
            request.sourceCode(),
            SelectionPolicy.SUBMIT_ALL
        );

        executionRunRecorder.record(
            evaluatedSandboxRun,
            request.sourceCode(),
            RunType.SUBMIT
        );

        RunCodeResponse runResponse = evaluatedSandboxRun.runResponse();
        Submission submission = submissionRepository.save(buildSubmission(
            request,
            user,
            evaluatedSandboxRun
        ));

        Map<Integer, TestCase> testCaseByNumber = indexTestCasesByNumber(evaluatedSandboxRun.testCases());
        submissionTestResultRepository.saveAll(buildSubmissionTestResults(
            submission,
            runResponse,
            testCaseByNumber
        ));

        UserChallengeProgress progress = progressTrackingService.updateFromSubmission(
            user,
            evaluatedSandboxRun.challenge(),
            submission
        );

        return new SubmitCodeResponse(
            submission.getId(),
            evaluatedSandboxRun.challenge().getSlug(),
            evaluatedSandboxRun.challengeLanguage().getLanguage().name(),
            submission.getStatus(),
            runResponse.totalTests(),
            runResponse.passedTests(),
            runResponse.failedTests(),
            submission.getScore(),
            runResponse.totalExecutionTimeMs(),
            evaluatedSandboxRun.peakMemoryUsedMb(),
            progress.isSolved(),
            progress.getBestScore(),
            buildSubmitResponseTestResults(runResponse, testCaseByNumber)
        );
    }

    private Submission buildSubmission(
        SubmitCodeRequest request,
        User user,
        EvaluatedSandboxRun evaluatedSandboxRun
    ) {
        RunCodeResponse runResponse = evaluatedSandboxRun.runResponse();
        int score = calculateScore(runResponse.passedTests(), runResponse.totalTests());

        return Submission.builder()
            .user(user)
            .challenge(evaluatedSandboxRun.challenge())
            .challengeLanguage(evaluatedSandboxRun.challengeLanguage())
            .submissionType(SubmissionType.SOLO)
            .sourceCode(request.sourceCode())
            .status(resolveSubmissionStatus(evaluatedSandboxRun))
            .passedCount(runResponse.passedTests())
            .totalCount(runResponse.totalTests())
            .score(score)
            .executionTimeMs(toNullableInt(runResponse.totalExecutionTimeMs()))
            .memoryUsedMb(evaluatedSandboxRun.peakMemoryUsedMb())
            .build();
    }

    private List<SubmissionTestResult> buildSubmissionTestResults(
        Submission submission,
        RunCodeResponse runResponse,
        Map<Integer, TestCase> testCaseByNumber
    ) {
        List<SubmissionTestResult> submissionTestResults = new ArrayList<>();
        for (RunTestCaseResult testResult : runResponse.testResults()) {
            TestCase testCase = testCaseByNumber.get(testResult.testNumber());
            if (testCase == null) {
                continue;
            }
            submissionTestResults.add(SubmissionTestResult.builder()
                .submission(submission)
                .testCase(testCase)
                .passed(testResult.passed())
                .actualOutput(testResult.actualOutput())
                .errorText(testResult.stderr())
                .executionTimeMs(toNullableInt(testResult.executionTimeMs()))
                .build()
            );
        }
        return submissionTestResults;
    }

    private List<SubmitTestCaseResult> buildSubmitResponseTestResults(
        RunCodeResponse runResponse,
        Map<Integer, TestCase> testCaseByNumber
    ) {
        List<SubmitTestCaseResult> strictResults = new ArrayList<>();
        for (RunTestCaseResult testResult : runResponse.testResults()) {
            TestCase testCase = testCaseByNumber.get(testResult.testNumber());
            boolean hidden = testCase == null || testCase.isHidden();
            strictResults.add(new SubmitTestCaseResult(
                testResult.testNumber(),
                hidden,
                testResult.passed(),
                testResult.status(),
                hidden ? "" : safeText(testResult.input()),
                hidden ? "" : safeText(testResult.expectedOutput()),
                hidden ? "" : safeText(testResult.actualOutput()),
                hidden ? "" : safeText(testResult.stdout()),
                hidden ? "" : safeText(testResult.stderr()),
                testResult.exitCode(),
                testResult.executionTimeMs(),
                testResult.memoryUsedMb()
            ));
        }
        return strictResults;
    }

    private Map<Integer, TestCase> indexTestCasesByNumber(
        List<TestCase> testCases
    ) {
        Map<Integer, TestCase> indexedCases = new HashMap<>();
        for (int index = 0; index < testCases.size(); index++) {
            indexedCases.put(index + 1, testCases.get(index));
        }
        return indexedCases;
    }

    private SubmissionStatus resolveSubmissionStatus(
        EvaluatedSandboxRun evaluatedSandboxRun
    ) {
        SandboxExecutionStatus rawStatus = evaluatedSandboxRun.rawExecution().status();
        if (rawStatus == SandboxExecutionStatus.TIMEOUT) {
            return SubmissionStatus.TIMEOUT;
        }
        if (rawStatus == SandboxExecutionStatus.SANDBOX_ERROR) {
            return SubmissionStatus.ERROR;
        }

        RunCodeResponse runResponse = evaluatedSandboxRun.runResponse();
        if (runResponse.status() == SandboxRunStatus.PASSED && runResponse.failedTests() == 0) {
            return SubmissionStatus.PASSED;
        }

        boolean hasTimeout = false;
        boolean hasRuntimeError = false;
        boolean hasSandboxError = false;
        boolean hasWrongAnswer = false;

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
            return SubmissionStatus.ERROR;
        }
        if (hasTimeout) {
            return SubmissionStatus.TIMEOUT;
        }
        if (hasRuntimeError || rawStatus == SandboxExecutionStatus.OUTPUT_LIMIT_EXCEEDED) {
            return SubmissionStatus.RUNTIME_ERROR;
        }
        if (hasWrongAnswer || runResponse.failedTests() > 0) {
            return SubmissionStatus.FAILED;
        }

        return SubmissionStatus.ERROR;
    }

    private int calculateScore(
        int passedCount,
        int totalCount
    ) {
        if (totalCount <= 0) {
            return 0;
        }
        return (int) Math.round((passedCount * 100.0) / totalCount);
    }

    private Integer toNullableInt(
        Long value
    ) {
        if (value == null) {
            return null;
        }
        return value > Integer.MAX_VALUE ? Integer.MAX_VALUE : value.intValue();
    }

    private String safeText(
        String value
    ) {
        return value == null ? "" : value;
    }
}
