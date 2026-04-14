package com.pairwiselive.backend.sandbox.application;

import com.pairwiselive.backend.model.entity.Challenge;
import com.pairwiselive.backend.model.entity.ChallengeLanguage;
import com.pairwiselive.backend.model.entity.TestCase;
import com.pairwiselive.backend.sandbox.api.dto.RunCodeResponse;
import com.pairwiselive.backend.sandbox.domain.SandboxExecutionResult;
import java.util.List;

public record EvaluatedSandboxRun(
    Challenge challenge,
    ChallengeLanguage challengeLanguage,
    List<TestCase> testCases,
    SandboxExecutionResult rawExecution,
    RunCodeResponse runResponse,
    Integer peakMemoryUsedMb
) {}
