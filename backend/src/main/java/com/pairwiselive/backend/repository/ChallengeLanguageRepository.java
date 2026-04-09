package com.pairwiselive.backend.repository;

import com.pairwiselive.backend.model.entity.ChallengeLanguage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChallengeLanguageRepository extends JpaRepository<ChallengeLanguage, Long> {
    List<ChallengeLanguage> findByChallengeIdOrderByDefaultLanguageDescIdAsc(Long challengeId);
}
