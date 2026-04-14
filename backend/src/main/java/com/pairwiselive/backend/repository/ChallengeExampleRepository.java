package com.pairwiselive.backend.repository;

import com.pairwiselive.backend.model.entity.ChallengeExample;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChallengeExampleRepository extends JpaRepository<ChallengeExample, Long> {
    List<ChallengeExample> findByChallengeIdOrderByIdAsc(Long challengeId);
}
