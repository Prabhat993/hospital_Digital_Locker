package com.example.digitallocker.config;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class AdminInitializer implements CommandLineRunner {

    @Override
    public void run(String... args) throws Exception {
        String adminUid = "3UcioT8mL9NxLdKusETh6HLrfKu1"; // <-- PASTE YOUR UID HERE

        try {
            // Check if the user already has custom claims
            var user = FirebaseAuth.getInstance().getUser(adminUid);
            if (user.getCustomClaims() == null || user.getCustomClaims().isEmpty()) {
                // Set the admin custom claim
                Map<String, Object> claims = Map.of("role", "admin");
                FirebaseAuth.getInstance().setCustomUserClaims(adminUid, claims);
                System.out.println("Admin role set for user: " + adminUid);
            } else {
                System.out.println("User " + adminUid + " already has custom claims.");
            }
        } catch (FirebaseAuthException e) {
            System.err.println("Error setting admin role: " + e.getMessage());
        }
    }
}