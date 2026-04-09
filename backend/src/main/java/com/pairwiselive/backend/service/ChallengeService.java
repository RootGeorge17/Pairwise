package com.pairwiselive.backend.service;

import com.pairwiselive.backend.model.dto.ChallengeLanguageDTO;
import com.pairwiselive.backend.model.dto.ChallengeResponseDTO;
import com.pairwiselive.backend.model.dto.ChallengeSummaryDTO;
import com.pairwiselive.backend.model.dto.TestCaseDTO;
import com.pairwiselive.backend.model.entity.Challenge;
import com.pairwiselive.backend.model.entity.ChallengeLanguage;
import com.pairwiselive.backend.model.entity.TestCase;
import com.pairwiselive.backend.model.enums.Visibility;
import com.pairwiselive.backend.repository.ChallengeLanguageRepository;
import com.pairwiselive.backend.repository.ChallengeRepository;
import com.pairwiselive.backend.repository.TestCaseRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class ChallengeService {
    private final ChallengeRepository challengeRepository;
    private final ChallengeLanguageRepository challengeLanguageRepository;
    private final TestCaseRepository testCaseRepository;

    @Transactional(readOnly = true)
    public List<ChallengeSummaryDTO> getAllChallenges() {
        return challengeRepository.findByVisibilityOrderByCreatedAtDesc(Visibility.PUBLIC)
                .stream()
                .map(challenge -> new ChallengeSummaryDTO(
                        challenge.getId(),
                        challenge.getSlug(),
                        challenge.getTitle(),
                        challenge.getDifficulty().name()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public ChallengeResponseDTO getChallengeBySlug(String slug) {
        Challenge challenge = challengeRepository.findBySlugAndVisibility(slug, Visibility.PUBLIC)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Challenge not found with slug: " + slug
                ));

        return toChallengeResponseDTO(challenge);
    }

    private ChallengeResponseDTO toChallengeResponseDTO(Challenge challenge) {
        List<ChallengeLanguageDTO> languageDTOs = challengeLanguageRepository
                .findByChallengeIdOrderByDefaultLanguageDescIdAsc(challenge.getId())
                .stream()
                .map(this::toChallengeLanguageDTO)
                .toList();

        List<TestCaseDTO> exampleDTOs = testCaseRepository
                .findByChallengeIdAndHiddenFalseOrderByIdAsc(challenge.getId())
                .stream()
                .map(this::toTestCaseDTO)
                .toList();

        return new ChallengeResponseDTO(
                challenge.getId(),
                challenge.getTitle(),
                challenge.getSlug(),
                challenge.getDescription(),
                challenge.getDifficulty().name(),
                challenge.getConstraintsText(),
                challenge.getFollowUpText(),
                languageDTOs,
                exampleDTOs
        );
    }

    private ChallengeLanguageDTO toChallengeLanguageDTO(ChallengeLanguage challengeLanguage) {
        return new ChallengeLanguageDTO(
                challengeLanguage.getId(),
                challengeLanguage.getLanguage().name(),
                challengeLanguage.getStarterCode(),
                challengeLanguage.getExpectedFunctionName(),
                challengeLanguage.getEntryFilename(),
                challengeLanguage.getTimeLimitMs(),
                challengeLanguage.getMemoryLimitMb(),
                challengeLanguage.isDefaultLanguage()
        );
    }

    private TestCaseDTO toTestCaseDTO(TestCase testCase) {
        return new TestCaseDTO(
                testCase.getInputData(),
                testCase.getExpectedOutput()
        );
    }
}
