package com.pairwiselive.backend.repository;

import com.pairwiselive.backend.model.entity.ExecutionRun;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExecutionRunRepository extends JpaRepository<ExecutionRun, Long> {
}
