package com.example.digitallocker.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.io.InputStream;

@Configuration
public class FirebaseConfig {

    @Bean
    public FirebaseApp initializeFirebase() throws IOException {
        // Use ClassPathResource to load the file from src/main/resources
        ClassPathResource resource = new ClassPathResource("hospital-digital-locker-firebase-adminsdk-fbsvc-01ef5763b3.json"); // <-- IMPORTANT: UPDATE THIS FILENAME

        InputStream serviceAccount = resource.getInputStream();

        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                .setStorageBucket("hospital-digital-locker.firebasestorage.app")// <-- IMPORTANT: UPDATE THIS BUCKET NAME
                .build();

        if (FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.initializeApp(options);
        } else {
            return FirebaseApp.getInstance();
        }
    }
}