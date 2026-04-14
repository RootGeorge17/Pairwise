package com.pairwiselive.backend.sandbox.application;

import com.pairwiselive.backend.model.entity.Challenge;
import com.pairwiselive.backend.model.entity.Submission;
import com.pairwiselive.backend.model.entity.User;
import com.pairwiselive.backend.model.entity.UserChallengeProgress;
import com.pairwiselive.backend.model.enums.SubmissionStatus;
import com.pairwiselive.backend.repository.UserChallengeProgressRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ProgressTrackingService {

    private final UserChallengeProgressRepository userChallengeProgressRepository;

    public UserChallengeProgress updateFromSubmission(
        User user,
        Challenge challenge,
        Submission submission
    ) {
        UserChallengeProgress progress = userChallengeProgressRepository
            .findByUserIdAndChallengeId(user.getId(), challenge.getId())
            .orElseGet(() -> UserChallengeProgress.builder()
                .user(user)
                .challenge(challenge)
                .build()
            );

        Instant now = Instant.now();
        progress.setAttemptCount(progress.getAttemptCount() + 1);
        progress.setLastAttemptAt(now);

        if (submission.getScore() > progress.getBestScore()) {
            progress.setBestScore(submission.getScore());
            progress.setBestSubmission(submission);
        }

        if (submission.getStatus() == SubmissionStatus.PASSED) {
            if (!progress.isSolved()) {
                progress.setSolved(true);
            }
            if (progress.getFirstSolvedAt() == null) {
                progress.setFirstSolvedAt(now);
            }
            if (progress.getBestSubmission() == null) {
                progress.setBestSubmission(submission);
            }
            if (submission.getScore() > progress.getBestScore()) {
                progress.setBestScore(submission.getScore());
            }
        }

        return userChallengeProgressRepository.save(progress);
    }
}
