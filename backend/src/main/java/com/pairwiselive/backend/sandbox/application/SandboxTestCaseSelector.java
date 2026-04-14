package com.pairwiselive.backend.sandbox.application;

import com.pairwiselive.backend.exception.UnprocessableEntityException;
import com.pairwiselive.backend.model.entity.TestCase;
import com.pairwiselive.backend.repository.TestCaseRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SandboxTestCaseSelector {

    public enum SelectionPolicy {
        RUN_VISIBLE_ONLY,
        SUBMIT_ALL
    }

    private final TestCaseRepository testCaseRepository;

    public List<TestCase> selectTestCases(
        Long challengeId,
        String challengeSlug,
        SelectionPolicy selectionPolicy
    ) {
        List<TestCase> testCases = switch (selectionPolicy) {
            case RUN_VISIBLE_ONLY -> testCaseRepository.findByChallengeIdAndHiddenFalseOrderByIdAsc(challengeId);
            case SUBMIT_ALL -> testCaseRepository.findByChallengeIdOrderByIdAsc(challengeId);
        };

        if (testCases.isEmpty()) {
            String message = selectionPolicy == SelectionPolicy.RUN_VISIBLE_ONLY
                ? "No visible test cases configured for challenge: "
                : "No evaluation test cases configured for challenge: ";
            throw new UnprocessableEntityException(message + challengeSlug);
        }

        return testCases;
    }
}
