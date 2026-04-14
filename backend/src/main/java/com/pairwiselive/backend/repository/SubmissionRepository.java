package com.pairwiselive.backend.repository;

import com.pairwiselive.backend.model.entity.Submission;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubmissionRepository extends JpaRepository<Submission, Long> {
}
