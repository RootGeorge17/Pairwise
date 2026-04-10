package com.pairwiselive.backend.controller;

import com.pairwiselive.backend.model.dto.ChallengeResponseDTO;
import com.pairwiselive.backend.model.dto.ChallengeSummaryDTO;
import com.pairwiselive.backend.service.ChallengeService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/challenges")
@RequiredArgsConstructor
public class ChallengeController {

    private final ChallengeService challengeService;

    @GetMapping
    public List<ChallengeSummaryDTO> getAllChallenges() {
        return challengeService.getAllChallenges();
    }

    @GetMapping("/{slug}")
    public ChallengeResponseDTO getChallengeBySlug(@PathVariable String slug) {
        return challengeService.getChallengeBySlug(slug);
    }
}
