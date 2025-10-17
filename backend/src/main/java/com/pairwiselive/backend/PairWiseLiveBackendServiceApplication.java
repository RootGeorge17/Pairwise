package com.pairwiselive.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@SpringBootApplication
public class PairWiseLiveBackendServiceApplication {
	public static void main(String[] args) {
		SpringApplication.run(PairWiseLiveBackendServiceApplication.class, args);
	}

    @GetMapping(value = "/")
    public String hello() {
        return "Hello World!";
    }
}
