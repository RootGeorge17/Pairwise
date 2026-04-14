package com.pairwiselive.backend.sandbox.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pairwiselive.backend.exception.BadRequestException;
import com.pairwiselive.backend.exception.ResourceNotFoundException;
import com.pairwiselive.backend.exception.UnprocessableEntityException;
import com.pairwiselive.backend.model.entity.Challenge;
import com.pairwiselive.backend.model.entity.ChallengeLanguage;
import com.pairwiselive.backend.model.entity.ExecutionRun;
import com.pairwiselive.backend.model.entity.TestCase;
import com.pairwiselive.backend.model.enums.ExecutionRunStatus;
import com.pairwiselive.backend.model.enums.Language;
import com.pairwiselive.backend.model.enums.RunType;
import com.pairwiselive.backend.model.enums.Visibility;
import com.pairwiselive.backend.repository.ChallengeLanguageRepository;
import com.pairwiselive.backend.repository.ChallengeRepository;
import com.pairwiselive.backend.repository.ExecutionRunRepository;
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
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SandboxExecutionService {

    private static final String RESULT_MARKER = "__PAIRWISE_RESULT__";
    private record RunnerParseResult(
        SandboxRunTestsResponse response,
        Integer peakMemoryUsedMb
    ) {
    }

    private final ChallengeRepository challengeRepository;
    private final ChallengeLanguageRepository challengeLanguageRepository;
    private final ExecutionRunRepository executionRunRepository;
    private final TestCaseRepository testCaseRepository;
    private final SandboxRunner sandboxRunner;
    private final SandboxInputMapper sandboxInputMapper;
    private final ObjectMapper objectMapper;

    @Transactional
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
        int aggregatedTimeLimitMs = calculateAggregatedTimeLimitMs(challengeLanguage.getTimeLimitMs(), testCases.size());

        SandboxExecutionRequest executionRequest = new SandboxExecutionRequest(
            request.sourceCode(),
            challengeLanguage.getEntryFilename(),
            challengeLanguage.getExpectedFunctionName(),
            challengeLanguage.getDockerImage(),
            aggregatedTimeLimitMs,
            challengeLanguage.getMemoryLimitMb(),
            sandboxInputMapper.toExecutionTestCasesJson(testCases)
        );

        SandboxExecutionResult executionResult = sandboxRunner.execute(executionRequest);
        if (executionResult.status() != SandboxExecutionStatus.SUCCESS && !containsRunnerResultPayload(executionResult.stdout())) {
            SandboxRunTestsResponse response = buildExecutionFailureResponse(
                challenge,
                challengeLanguage,
                testCases,
                executionResult
            );
            saveExecutionRun(challenge, challengeLanguage, request.sourceCode(), executionResult, null);
            return response;
        }

        RunnerParseResult parsedResult;
        try {
            parsedResult = parseRunnerSuccessResponse(
                challenge,
                challengeLanguage,
                testCases,
                executionResult.stdout()
            );
        } catch (RuntimeException exception) {
            saveExecutionRun(
                challenge,
                challengeLanguage,
                request.sourceCode(),
                new SandboxExecutionResult(
                    false,
                    false,
                    SandboxExecutionStatus.SANDBOX_ERROR,
                    executionResult.stdout(),
                    exception.getMessage(),
                    executionResult.exitCode(),
                    executionResult.executionTimeMs(),
                    executionResult.stdoutTruncated(),
                    executionResult.stderrTruncated()
                ),
                null
            );
            throw exception;
        }
        saveExecutionRun(
            challenge,
            challengeLanguage,
            request.sourceCode(),
            executionResult,
            parsedResult.peakMemoryUsedMb()
        );
        return parsedResult.response();
    }

    private boolean containsRunnerResultPayload(
        String processStdout
    ) {
        if (TextUtils.isBlank(processStdout)) {
            return false;
        }
        return processStdout.contains(RESULT_MARKER);
    }

    private RunnerParseResult parseRunnerSuccessResponse(
        Challenge challenge,
        ChallengeLanguage challengeLanguage,
        List<TestCase> testCases,
        String processStdout
    ) {
        String jsonPayload = extractResultPayload(processStdout);
        JsonNode rootNode;
        try {
            rootNode = objectMapper.readTree(jsonPayload);
        } catch (JsonProcessingException exception) {
            throw new UnprocessableEntityException("Sandbox returned invalid JSON result payload.");
        }

        Map<Integer, TestCase> testCaseByNumber = indexTestCases(testCases);
        List<SandboxTestCaseResult> testResults = parseTestResults(rootNode.path("testResults"), testCaseByNumber);

        int totalTests = readIntOrDefault(rootNode, "totalTests", testResults.size());
        int passedTests = readIntOrDefault(rootNode, "passedTests", countPassed(testResults));
        int failedTests = readIntOrDefault(rootNode, "failedTests", Math.max(0, totalTests - passedTests));
        long totalExecutionTimeMs = readLongOrDefault(rootNode, "totalExecutionTimeMs", sumExecutionTime(testResults));
        long averageExecutionTimeMs = readLongOrDefault(
            rootNode,
            "averageExecutionTimeMs",
            totalTests > 0 ? totalExecutionTimeMs / totalTests : 0L
        );
        Integer peakMemoryUsedMb = readNullableInt(rootNode.get("peakMemoryUsedMb"));
        if (peakMemoryUsedMb == null) {
            peakMemoryUsedMb = readNullableInt(rootNode.get("peakMemoryUsedKb"));
        }
        if (peakMemoryUsedMb == null) {
            peakMemoryUsedMb = calculatePeakMemoryUsedMb(testResults);
        }

        SandboxRunStatus status = parseRunStatus(
            rootNode.path("status").asText(failedTests == 0 ? SandboxRunStatus.PASSED.name() : SandboxRunStatus.FAILED.name())
        );

        return new RunnerParseResult(
            new SandboxRunTestsResponse(
                challenge.getSlug(),
                challengeLanguage.getLanguage().name(),
                status,
                totalTests,
                passedTests,
                failedTests,
                totalExecutionTimeMs,
                averageExecutionTimeMs,
                peakMemoryUsedMb,
                challengeLanguage.getTimeLimitMs(),
                challengeLanguage.getMemoryLimitMb(),
                testResults
            ),
            peakMemoryUsedMb
        );
    }

    private List<SandboxTestCaseResult> parseTestResults(JsonNode testResultsNode, Map<Integer, TestCase> testCaseByNumber) {
        List<SandboxTestCaseResult> parsedResults = new ArrayList<>();
        if (!testResultsNode.isArray()) {
            return parsedResults;
        }

        for (JsonNode testResultNode : testResultsNode) {
            int testNumber = readIntOrDefault(testResultNode, "testNumber", parsedResults.size() + 1);
            TestCase sourceCase = testCaseByNumber.get(testNumber);

            String input = readStringOrDefault(testResultNode, "input", sourceCase != null ? sourceCase.getInputData() : "");
            String expectedOutput = readStringOrDefault(
                testResultNode,
                "expectedOutput",
                sourceCase != null ? sourceCase.getExpectedOutput() : ""
            );

            parsedResults.add(new SandboxTestCaseResult(
                testNumber,
                testResultNode.path("passed").asBoolean(false),
                parseTestStatus(testResultNode.path("status").asText(SandboxTestStatus.SANDBOX_ERROR.name())),
                input,
                expectedOutput,
                readStringOrDefault(testResultNode, "actualOutput", ""),
                readStringOrDefault(testResultNode, "stdout", ""),
                readStringOrDefault(testResultNode, "stderr", ""),
                readNullableInt(testResultNode.get("exitCode")),
                readNullableLong(testResultNode.get("executionTimeMs")),
                readTestMemoryUsedMb(testResultNode),
                testResultNode.path("stdoutTruncated").asBoolean(false),
                testResultNode.path("stderrTruncated").asBoolean(false)
            ));
        }

        return parsedResults;
    }

    private SandboxRunTestsResponse buildExecutionFailureResponse(
        Challenge challenge,
        ChallengeLanguage challengeLanguage,
        List<TestCase> testCases,
        SandboxExecutionResult executionResult
    ) {
        SandboxTestStatus status = mapExecutionStatusToTestStatus(executionResult.status());
        String errorMessage = TextUtils.normalizeToEmptyTrimmed(executionResult.stderr());
        List<SandboxTestCaseResult> testResults = new ArrayList<>();

        for (int index = 0; index < testCases.size(); index++) {
            TestCase testCase = testCases.get(index);
            testResults.add(new SandboxTestCaseResult(
                index + 1,
                false,
                status,
                testCase.getInputData(),
                testCase.getExpectedOutput(),
                "",
                "",
                errorMessage,
                executionResult.exitCode(),
                executionResult.executionTimeMs(),
                null,
                executionResult.stdoutTruncated(),
                executionResult.stderrTruncated()
            ));
        }

        int totalTests = testResults.size();
        long totalExecutionTimeMs = executionResult.executionTimeMs() != null ? executionResult.executionTimeMs() : 0L;
        long averageExecutionTimeMs = totalTests > 0 ? totalExecutionTimeMs / totalTests : 0L;

        return new SandboxRunTestsResponse(
            challenge.getSlug(),
            challengeLanguage.getLanguage().name(),
            SandboxRunStatus.FAILED,
            totalTests,
            0,
            totalTests,
            totalExecutionTimeMs,
            averageExecutionTimeMs,
            null,
            challengeLanguage.getTimeLimitMs(),
            challengeLanguage.getMemoryLimitMb(),
            testResults
        );
    }

    private String extractResultPayload(String processStdout) {
        String normalizedStdout = processStdout == null ? "" : processStdout;
        int markerIndex = normalizedStdout.lastIndexOf(RESULT_MARKER);
        if (markerIndex < 0) {
            throw new UnprocessableEntityException("Sandbox result marker not found in execution output.");
        }

        String payload = normalizedStdout.substring(markerIndex + RESULT_MARKER.length()).trim();
        if (payload.isEmpty()) {
            throw new UnprocessableEntityException("Sandbox returned an empty result payload.");
        }

        return payload;
    }

    private Map<Integer, TestCase> indexTestCases(List<TestCase> testCases) {
        Map<Integer, TestCase> indexedCases = new HashMap<>();
        for (int index = 0; index < testCases.size(); index++) {
            indexedCases.put(index + 1, testCases.get(index));
        }
        return indexedCases;
    }

    private int countPassed(List<SandboxTestCaseResult> testResults) {
        int passedCount = 0;
        for (SandboxTestCaseResult testResult : testResults) {
            if (testResult.passed()) {
                passedCount++;
            }
        }
        return passedCount;
    }

    private long sumExecutionTime(List<SandboxTestCaseResult> testResults) {
        long sum = 0L;
        for (SandboxTestCaseResult testResult : testResults) {
            sum += testResult.executionTimeMs() != null ? testResult.executionTimeMs() : 0L;
        }
        return sum;
    }

    private Integer calculatePeakMemoryUsedMb(
        List<SandboxTestCaseResult> testResults
    ) {
        Integer peak = null;
        for (SandboxTestCaseResult testResult : testResults) {
            Integer memoryUsedMb = testResult.memoryUsedMb();
            if (memoryUsedMb == null) {
                continue;
            }
            peak = peak == null ? memoryUsedMb : Math.max(peak, memoryUsedMb);
        }
        return peak;
    }

    private Integer readTestMemoryUsedMb(
        JsonNode testResultNode
    ) {
        Integer memoryUsedMb = readNullableInt(testResultNode.get("memoryUsedMb"));
        if (memoryUsedMb != null) {
            return memoryUsedMb;
        }

        Integer memoryUsedKb = readNullableInt(testResultNode.get("memoryUsedKb"));
        if (memoryUsedKb == null) {
            return null;
        }
        return Math.max(0, (int) Math.round(memoryUsedKb / 1024.0));
    }

    private int readIntOrDefault(JsonNode sourceNode, String field, int fallbackValue) {
        JsonNode valueNode = sourceNode.get(field);
        return valueNode != null && valueNode.canConvertToInt() ? valueNode.asInt() : fallbackValue;
    }

    private long readLongOrDefault(JsonNode sourceNode, String field, long fallbackValue) {
        JsonNode valueNode = sourceNode.get(field);
        return valueNode != null && valueNode.canConvertToLong() ? valueNode.asLong() : fallbackValue;
    }

    private String readStringOrDefault(JsonNode sourceNode, String field, String fallbackValue) {
        JsonNode valueNode = sourceNode.get(field);
        return valueNode != null && valueNode.isTextual() ? valueNode.asText() : fallbackValue;
    }

    private Integer readNullableInt(JsonNode valueNode) {
        if (valueNode == null || valueNode.isNull() || !valueNode.canConvertToInt()) {
            return null;
        }
        return valueNode.asInt();
    }

    private Long readNullableLong(JsonNode valueNode) {
        if (valueNode == null || valueNode.isNull() || !valueNode.canConvertToLong()) {
            return null;
        }
        return valueNode.asLong();
    }

    private SandboxRunStatus parseRunStatus(String value) {
        try {
            return SandboxRunStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ignored) {
            return SandboxRunStatus.FAILED;
        }
    }

    private SandboxTestStatus parseTestStatus(String value) {
        try {
            return SandboxTestStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ignored) {
            return SandboxTestStatus.SANDBOX_ERROR;
        }
    }

    private SandboxTestStatus mapExecutionStatusToTestStatus(SandboxExecutionStatus status) {
        return switch (status) {
            case TIMEOUT -> SandboxTestStatus.TIMEOUT;
            case RUNTIME_ERROR -> SandboxTestStatus.RUNTIME_ERROR;
            case SANDBOX_ERROR -> SandboxTestStatus.SANDBOX_ERROR;
            case OUTPUT_LIMIT_EXCEEDED -> SandboxTestStatus.OUTPUT_LIMIT_EXCEEDED;
            case SUCCESS -> SandboxTestStatus.SANDBOX_ERROR;
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

    private int calculateAggregatedTimeLimitMs(int timeLimitPerTestMs, int totalTests) {
        long aggregated = (long) timeLimitPerTestMs * Math.max(totalTests, 1);
        return aggregated > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) aggregated;
    }

    private void saveExecutionRun(
        Challenge challenge,
        ChallengeLanguage challengeLanguage,
        String sourceCode,
        SandboxExecutionResult executionResult,
        Integer memoryUsedMb
    ) {
        ExecutionRun executionRun = Objects.requireNonNull(
            ExecutionRun.builder()
                .challenge(challenge)
                .challengeLanguage(challengeLanguage)
                .sourceCode(sourceCode)
                .runType(RunType.RUN)
                .status(mapExecutionStatusToRunStatus(executionResult.status()))
                .stdout(executionResult.stdout())
                .stderr(executionResult.stderr())
                .exitCode(executionResult.exitCode())
                .executionTimeMs(toNullableInt(executionResult.executionTimeMs()))
                .memoryUsedMb(memoryUsedMb)
                .build()
        );
        executionRunRepository.save(executionRun);
    }

    private ExecutionRunStatus mapExecutionStatusToRunStatus(
        SandboxExecutionStatus status
    ) {
        return switch (status) {
            case SUCCESS -> ExecutionRunStatus.SUCCESS;
            case TIMEOUT -> ExecutionRunStatus.TIMEOUT;
            case RUNTIME_ERROR, OUTPUT_LIMIT_EXCEEDED -> ExecutionRunStatus.RUNTIME_ERROR;
            case SANDBOX_ERROR -> ExecutionRunStatus.SANDBOX_ERROR;
        };
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
