package com.pairwiselive.backend.repository;

import com.pairwiselive.backend.model.entity.ChallengeLanguage;
import com.pairwiselive.backend.model.enums.Language;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChallengeLanguageRepository extends JpaRepository<ChallengeLanguage, Long> {
    List<ChallengeLanguage> findByChallengeIdOrderByDefaultLanguageDescIdAsc(Long challengeId);
    Optional<ChallengeLanguage> findByChallengeIdAndLanguage(Long challengeId, Language language);
}
