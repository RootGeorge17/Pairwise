package com.pairwiselive.backend.repository;

import com.pairwiselive.backend.model.entity.TestCase;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCase, Long> {
    List<TestCase> findByChallengeIdAndHiddenFalseOrderByIdAsc(Long challengeId);
    List<TestCase> findByChallengeIdOrderByIdAsc(Long challengeId);
}
