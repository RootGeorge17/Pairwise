package com.pairwiselive.backend.repository;

import com.pairwiselive.backend.model.entity.Challenge;
import com.pairwiselive.backend.model.enums.Visibility;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChallengeRepository extends JpaRepository<Challenge, Long> {
    List<Challenge> findByVisibilityOrderByCreatedAtDesc(Visibility visibility);
    Optional<Challenge> findBySlugAndVisibility(String slug, Visibility visibility);
    boolean existsBySlug(String slug);
}
