package com.pairwiselive.backend.sandbox.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pairwiselive.backend.exception.UnprocessableEntityException;
import com.pairwiselive.backend.model.entity.Challenge;
import com.pairwiselive.backend.model.entity.ChallengeLanguage;
import com.pairwiselive.backend.model.entity.TestCase;
import com.pairwiselive.backend.sandbox.api.dto.RunCodeResponse;
import com.pairwiselive.backend.sandbox.api.dto.RunTestCaseResult;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionResult;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionStatus;
import com.pairwiselive.backend.sandbox.domain.SandboxRunStatus;
import com.pairwiselive.backend.sandbox.domain.SandboxTestStatus;
import com.pairwiselive.backend.util.text.TextUtils;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SandboxRunnerResultParser {

    private static final String RESULT_MARKER = "__PAIRWISE_RESULT__";

    public record ParsedRunnerResult(
        RunCodeResponse response,
        Integer peakMemoryUsedMb
    ) {
    }

    private final ObjectMapper objectMapper;

    public ParsedRunnerResult parse(
        Challenge challenge,
        ChallengeLanguage challengeLanguage,
        List<TestCase> testCases,
        SandboxExecutionResult executionResult
    ) {
        if (!containsRunnerPayload(executionResult.stdout())) {
            return buildExecutionFailureResponse(
                challenge,
                challengeLanguage,
                testCases,
                executionResult
            );
        }

        return parseRunnerPayload(
            challenge,
            challengeLanguage,
            testCases,
            executionResult.stdout()
        );
    }

    private ParsedRunnerResult parseRunnerPayload(
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
        List<RunTestCaseResult> testResults = parseTestResults(rootNode.path("testResults"), testCaseByNumber);

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
            rootNode.path("status").asText(
                failedTests == 0 ? SandboxRunStatus.PASSED.name() : SandboxRunStatus.FAILED.name()
            )
        );

        return new ParsedRunnerResult(
            new RunCodeResponse(
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

    private ParsedRunnerResult buildExecutionFailureResponse(
        Challenge challenge,
        ChallengeLanguage challengeLanguage,
        List<TestCase> testCases,
        SandboxExecutionResult executionResult
    ) {
        SandboxTestStatus status = mapExecutionStatusToTestStatus(executionResult.status());
        String errorMessage = TextUtils.normalizeToEmptyTrimmed(executionResult.stderr());
        List<RunTestCaseResult> testResults = new ArrayList<>();

        for (int index = 0; index < testCases.size(); index++) {
            TestCase testCase = testCases.get(index);
            testResults.add(new RunTestCaseResult(
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

        return new ParsedRunnerResult(
            new RunCodeResponse(
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
            ),
            null
        );
    }

    private List<RunTestCaseResult> parseTestResults(
        JsonNode testResultsNode,
        Map<Integer, TestCase> testCaseByNumber
    ) {
        List<RunTestCaseResult> parsedResults = new ArrayList<>();
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

            parsedResults.add(new RunTestCaseResult(
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

    private boolean containsRunnerPayload(
        String processStdout
    ) {
        if (TextUtils.isBlank(processStdout)) {
            return false;
        }
        return processStdout.contains(RESULT_MARKER);
    }

    private Map<Integer, TestCase> indexTestCases(List<TestCase> testCases) {
        Map<Integer, TestCase> indexedCases = new HashMap<>();
        for (int index = 0; index < testCases.size(); index++) {
            indexedCases.put(index + 1, testCases.get(index));
        }
        return indexedCases;
    }

    private int countPassed(List<RunTestCaseResult> testResults) {
        int passedCount = 0;
        for (RunTestCaseResult testResult : testResults) {
            if (testResult.passed()) {
                passedCount++;
            }
        }
        return passedCount;
    }

    private long sumExecutionTime(List<RunTestCaseResult> testResults) {
        long sum = 0L;
        for (RunTestCaseResult testResult : testResults) {
            sum += testResult.executionTimeMs() != null ? testResult.executionTimeMs() : 0L;
        }
        return sum;
    }

    private Integer calculatePeakMemoryUsedMb(
        List<RunTestCaseResult> testResults
    ) {
        Integer peak = null;
        for (RunTestCaseResult testResult : testResults) {
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
}
