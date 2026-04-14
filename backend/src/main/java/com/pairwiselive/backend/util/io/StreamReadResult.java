package com.pairwiselive.backend.util.io;

public record StreamReadResult(
    String content,
    boolean truncated
) {}
