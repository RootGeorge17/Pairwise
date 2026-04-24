package com.pairwiselive.backend.repository;

import com.pairwiselive.backend.model.entity.Lobby;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface LobbyRepository extends JpaRepository<Lobby, Long> {
    Optional<Lobby> findByJoinCode(String joinCode);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from Lobby l where l.joinCode = :joinCode")
    Optional<Lobby> findByJoinCodeForUpdate(@Param("joinCode") String joinCode);
    boolean existsByJoinCode(String joinCode);
    List<Lobby> findByHostUserId(Long hostUserId);
}
