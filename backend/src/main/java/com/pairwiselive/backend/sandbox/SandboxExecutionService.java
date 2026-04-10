package com.pairwiselive.backend.sandbox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pairwiselive.backend.model.entity.Challenge;
import com.pairwiselive.backend.model.entity.ChallengeLanguage;
import com.pairwiselive.backend.model.entity.TestCase;
import com.pairwiselive.backend.model.enums.Language;
import com.pairwiselive.backend.model.enums.Visibility;
import com.pairwiselive.backend.repository.ChallengeLanguageRepository;
import com.pairwiselive.backend.repository.ChallengeRepository;
import com.pairwiselive.backend.repository.TestCaseRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class SandboxExecutionService {

    private final ChallengeRepository challengeRepository;
    private final ChallengeLanguageRepository challengeLanguageRepository;
    private final TestCaseRepository testCaseRepository;
    private final SandboxRunner sandboxRunner;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public SandboxRunTestsResponse runTests(SandboxRunTestsRequest request) {
        validateRequest(request);

        Challenge challenge = challengeRepository.findBySlugAndVisibility(request.slug(), Visibility.PUBLIC)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Challenge not found with slug: " + request.slug()
            ));

        Language language = parseLanguage(request.language());
        ChallengeLanguage challengeLanguage = challengeLanguageRepository
            .findByChallengeIdAndLanguage(challenge.getId(), language)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Language " + language.name() + " is not configured for challenge: " + challenge.getSlug()
            ));

        List<TestCase> testCases = testCaseRepository.findByChallengeIdAndHiddenFalseOrderByIdAsc(challenge.getId());
        if (testCases.isEmpty()) {
            testCases = testCaseRepository.findByChallengeIdOrderByIdAsc(challenge.getId());
        }
        if (testCases.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "No runnable test cases configured for challenge: " + challenge.getSlug()
            );
        }

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
        String status = failedTests == 0 ? "PASSED" : "FAILED";

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
            testCase.getInputData()
        );

        SandboxExecutionResult executionResult = sandboxRunner.execute(executionRequest);
        String actualOutput = normalize(executionResult.stdout());
        String expectedOutput = normalize(testCase.getExpectedOutput());

        boolean passed = executionResult.success() && outputsEqual(actualOutput, expectedOutput);
        String status = passed
            ? "PASSED"
            : executionResult.success() ? "WRONG_ANSWER" : executionResult.status();

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
            executionResult.executionTimeMs()
        );
    }

    private void validateRequest(SandboxRunTestsRequest request) {
        if (request == null
            || isBlank(request.slug())
            || isBlank(request.language())
            || isBlank(request.sourceCode())) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "slug, language, and sourceCode are required."
            );
        }
    }

    private Language parseLanguage(String language) {
        try {
            return Language.valueOf(language.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported language: " + language);
        }
    }

    private boolean outputsEqual(String actualOutput, String expectedOutput) {
        try {
            JsonNode actualNode = objectMapper.readTree(actualOutput);
            JsonNode expectedNode = objectMapper.readTree(expectedOutput);
            return actualNode.equals(expectedNode);
        } catch (JsonProcessingException ignored) {
            return actualOutput.equals(expectedOutput);
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
