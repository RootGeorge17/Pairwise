package com.pairwiselive.backend.repository;

import com.pairwiselive.backend.model.entity.UserChallengeProgress;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserChallengeProgressRepository extends JpaRepository<UserChallengeProgress, Long> {

    Optional<UserChallengeProgress> findByUserIdAndChallengeId(
        Long userId,
        Long challengeId
    );
}
