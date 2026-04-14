package com.pairwiselive.backend.sandbox.application;

import com.pairwiselive.backend.model.entity.Challenge;
import com.pairwiselive.backend.model.entity.ChallengeLanguage;
import com.pairwiselive.backend.model.entity.TestCase;
import com.pairwiselive.backend.sandbox.application.SandboxRunnerResultParser.ParsedRunnerResult;
import com.pairwiselive.backend.sandbox.application.SandboxTestCaseSelector.SelectionPolicy;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionRequest;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionResult;
import com.pairwiselive.backend.sandbox.domain.SandboxRunner;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SandboxBatchExecutionService {

    private final SandboxChallengeResolver sandboxChallengeResolver;
    private final SandboxTestCaseSelector sandboxTestCaseSelector;
    private final SandboxRunner sandboxRunner;
    private final SandboxInputMapper sandboxInputMapper;
    private final SandboxRunnerResultParser sandboxRunnerResultParser;

    public EvaluatedSandboxRun evaluate(
        String slug,
        String language,
        String sourceCode,
        SelectionPolicy selectionPolicy
    ) {
        Challenge challenge = sandboxChallengeResolver.resolvePublicChallengeBySlug(slug);
        ChallengeLanguage challengeLanguage = sandboxChallengeResolver.resolveChallengeLanguage(challenge, language);
        List<TestCase> testCases = sandboxTestCaseSelector.selectTestCases(
            challenge.getId(),
            challenge.getSlug(),
            selectionPolicy
        );

        int aggregatedTimeLimitMs = calculateAggregatedTimeLimitMs(
            challengeLanguage.getTimeLimitMs(),
            testCases.size()
        );

        SandboxExecutionRequest executionRequest = new SandboxExecutionRequest(
            sourceCode,
            challengeLanguage.getEntryFilename(),
            challengeLanguage.getExpectedFunctionName(),
            challengeLanguage.getDockerImage(),
            aggregatedTimeLimitMs,
            challengeLanguage.getMemoryLimitMb(),
            sandboxInputMapper.toExecutionTestCasesJson(testCases)
        );

        SandboxExecutionResult executionResult = sandboxRunner.execute(executionRequest);
        ParsedRunnerResult parsedRunnerResult = sandboxRunnerResultParser.parse(
            challenge,
            challengeLanguage,
            testCases,
            executionResult
        );

        return new EvaluatedSandboxRun(
            challenge,
            challengeLanguage,
            testCases,
            executionResult,
            parsedRunnerResult.response(),
            parsedRunnerResult.peakMemoryUsedMb()
        );
    }

    private int calculateAggregatedTimeLimitMs(
        int timeLimitPerTestMs,
        int totalTests
    ) {
        long aggregated = (long) timeLimitPerTestMs * Math.max(totalTests, 1);
        return aggregated > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) aggregated;
    }
}
