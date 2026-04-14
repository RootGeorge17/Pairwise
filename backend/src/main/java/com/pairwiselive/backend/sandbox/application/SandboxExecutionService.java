package com.pairwiselive.backend.sandbox.application;

import com.pairwiselive.backend.exception.BadRequestException;
import com.pairwiselive.backend.exception.ResourceNotFoundException;
import com.pairwiselive.backend.exception.UnprocessableEntityException;
import com.pairwiselive.backend.model.entity.Challenge;
import com.pairwiselive.backend.model.entity.ChallengeLanguage;
import com.pairwiselive.backend.model.entity.TestCase;
import com.pairwiselive.backend.model.enums.Language;
import com.pairwiselive.backend.model.enums.Visibility;
import com.pairwiselive.backend.repository.ChallengeLanguageRepository;
import com.pairwiselive.backend.repository.ChallengeRepository;
import com.pairwiselive.backend.repository.TestCaseRepository;
import com.pairwiselive.backend.sandbox.api.dto.SandboxRunTestsRequest;
import com.pairwiselive.backend.sandbox.api.dto.SandboxRunTestsResponse;
import com.pairwiselive.backend.sandbox.api.dto.SandboxTestCaseResult;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionRequest;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionResult;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionStatus;
import com.pairwiselive.backend.sandbox.domain.SandboxRunStatus;
import com.pairwiselive.backend.sandbox.domain.SandboxRunner;
import com.pairwiselive.backend.sandbox.domain.SandboxTestStatus;
import com.pairwiselive.backend.util.text.TextUtils;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SandboxExecutionService {

    private final ChallengeRepository challengeRepository;
    private final ChallengeLanguageRepository challengeLanguageRepository;
    private final TestCaseRepository testCaseRepository;
    private final SandboxRunner sandboxRunner;
    private final SandboxOutputComparator outputComparator;
    private final SandboxInputMapper sandboxInputMapper;

    @Transactional(readOnly = true)
    public SandboxRunTestsResponse runTests(
        SandboxRunTestsRequest request
    ) {
        Challenge challenge = challengeRepository.findBySlugAndVisibility(request.slug(), Visibility.PUBLIC)
            .orElseThrow(() -> new ResourceNotFoundException(
                "Challenge not found with slug: " + request.slug()
            ));

        Language language = parseLanguage(request.language());
        ChallengeLanguage challengeLanguage = challengeLanguageRepository
            .findByChallengeIdAndLanguage(challenge.getId(), language)
            .orElseThrow(() -> new BadRequestException(
                "Language " + language.name() + " is not configured for challenge: " + challenge.getSlug()
            ));

        List<TestCase> testCases = resolveRunnableTestCases(challenge.getId(), challenge.getSlug());

        List<SandboxTestCaseResult> testResults = new ArrayList<>();
        int passedTests = 0;
        long totalExecutionTimeMs = 0L;

        for (int index = 0; index < testCases.size(); index++) {
            TestCase testCase = testCases.get(index);
            SandboxTestCaseResult testResult = runSingleTestCase(request, challengeLanguage, testCase, index + 1);
            testResults.add(testResult);

            if (testResult.passed()) {
                passedTests++;
            }
            totalExecutionTimeMs += testResult.executionTimeMs() != null ? testResult.executionTimeMs() : 0L;
        }

        int totalTests = testResults.size();
        int failedTests = totalTests - passedTests;
        long averageExecutionTimeMs = totalTests == 0 ? 0 : totalExecutionTimeMs / totalTests;
        SandboxRunStatus status = failedTests == 0 ? SandboxRunStatus.PASSED : SandboxRunStatus.FAILED;

        return new SandboxRunTestsResponse(
            challenge.getSlug(),
            challengeLanguage.getLanguage().name(),
            status,
            totalTests,
            passedTests,
            failedTests,
            totalExecutionTimeMs,
            averageExecutionTimeMs,
            challengeLanguage.getTimeLimitMs(),
            challengeLanguage.getMemoryLimitMb(),
            testResults
        );
    }

    private SandboxTestCaseResult runSingleTestCase(
        SandboxRunTestsRequest request,
        ChallengeLanguage challengeLanguage,
        TestCase testCase,
        int testNumber
    ) {
        SandboxExecutionRequest executionRequest = new SandboxExecutionRequest(
            request.sourceCode(),
            challengeLanguage.getEntryFilename(),
            challengeLanguage.getExpectedFunctionName(),
            challengeLanguage.getDockerImage(),
            challengeLanguage.getTimeLimitMs(),
            challengeLanguage.getMemoryLimitMb(),
            sandboxInputMapper.toExecutionInputJson(testCase.getInputData())
        );

        SandboxExecutionResult executionResult = sandboxRunner.execute(executionRequest);
        String actualOutput = TextUtils.normalizeToEmptyTrimmed(executionResult.stdout());
        String expectedOutput = TextUtils.normalizeToEmptyTrimmed(testCase.getExpectedOutput());

        boolean passed = executionResult.success() && outputComparator.areEqual(actualOutput, expectedOutput);
        SandboxTestStatus status = passed
            ? SandboxTestStatus.PASSED
            : executionResult.status() == SandboxExecutionStatus.SUCCESS
                ? SandboxTestStatus.WRONG_ANSWER
                : mapExecutionStatusToTestStatus(executionResult.status());

        return new SandboxTestCaseResult(
            testNumber,
            passed,
            status,
            testCase.getInputData(),
            testCase.getExpectedOutput(),
            actualOutput,
            executionResult.stdout(),
            executionResult.stderr(),
            executionResult.exitCode(),
            executionResult.executionTimeMs(),
            executionResult.stdoutTruncated(),
            executionResult.stderrTruncated()
        );
    }

    private SandboxTestStatus mapExecutionStatusToTestStatus(SandboxExecutionStatus status) {
        return switch (status) {
            case TIMEOUT -> SandboxTestStatus.TIMEOUT;
            case RUNTIME_ERROR -> SandboxTestStatus.RUNTIME_ERROR;
            case SANDBOX_ERROR -> SandboxTestStatus.SANDBOX_ERROR;
            case OUTPUT_LIMIT_EXCEEDED -> SandboxTestStatus.OUTPUT_LIMIT_EXCEEDED;
            case SUCCESS -> SandboxTestStatus.WRONG_ANSWER;
        };
    }

    private List<TestCase> resolveRunnableTestCases(
        Long challengeId, 
        String challengeSlug
    ) {
        List<TestCase> testCases = testCaseRepository.findByChallengeIdAndHiddenFalseOrderByIdAsc(challengeId);
        if (testCases.isEmpty()) {
            testCases = testCaseRepository.findByChallengeIdOrderByIdAsc(challengeId);
        }
        if (testCases.isEmpty()) {
            throw new UnprocessableEntityException(
                "No runnable test cases configured for challenge: " + challengeSlug
            );
        }
        return testCases;
    }

    private Language parseLanguage(
        String language
    ) {
        if (TextUtils.isBlank(language)) {
            throw new BadRequestException("language is required.");
        }

        try {
            return Language.valueOf(language.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("Unsupported language: " + language);
        }
    }
}
