package com.pairwiselive.backend.sandbox.application;

import com.pairwiselive.backend.exception.BadRequestException;
import com.pairwiselive.backend.exception.ResourceNotFoundException;
import com.pairwiselive.backend.model.entity.Challenge;
import com.pairwiselive.backend.model.entity.ChallengeLanguage;
import com.pairwiselive.backend.model.enums.Language;
import com.pairwiselive.backend.model.enums.Visibility;
import com.pairwiselive.backend.repository.ChallengeLanguageRepository;
import com.pairwiselive.backend.repository.ChallengeRepository;
import com.pairwiselive.backend.util.text.TextUtils;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SandboxChallengeResolver {

    private final ChallengeRepository challengeRepository;
    private final ChallengeLanguageRepository challengeLanguageRepository;

    public Challenge resolvePublicChallengeBySlug(
        String slug
    ) {
        return challengeRepository.findBySlugAndVisibility(slug, Visibility.PUBLIC)
            .orElseThrow(() -> new ResourceNotFoundException(
                "Challenge not found with slug: " + slug
            ));
    }

    public ChallengeLanguage resolveChallengeLanguage(
        Challenge challenge,
        String language
    ) {
        Language parsedLanguage = parseLanguage(language);
        return challengeLanguageRepository
            .findByChallengeIdAndLanguage(challenge.getId(), parsedLanguage)
            .orElseThrow(() -> new BadRequestException(
                "Language " + parsedLanguage.name() + " is not configured for challenge: " + challenge.getSlug()
            ));
    }

    private Language parseLanguage(
        String language
    ) {
        if (TextUtils.isBlank(language)) {
            throw new BadRequestException("language is required.");
        }

        try {
            return Language.valueOf(language.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("Unsupported language: " + language);
        }
    }
}
