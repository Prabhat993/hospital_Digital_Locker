package com.example.digitallocker.controller;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.UserRecord;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    // --- NEW: Create User Endpoint ---
    @PostMapping("/create-user")
    public ResponseEntity<Map<String, String>> createUser(@RequestBody Map<String, String> payload) {
        try {
            String email = payload.get("email");
            String password = payload.get("password");
            String role = payload.get("role"); // Expected "doctor" or "patient"

            if (!role.equals("doctor") && !role.equals("patient")) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid role specified."));
            }

            // Create user in Firebase Authentication
            UserRecord.CreateRequest request = new UserRecord.CreateRequest()
                    .setEmail(email)
                    .setPassword(password)
                    .setEmailVerified(false) // Or true, depending on your policy
                    .setDisabled(false);
            UserRecord userRecord = FirebaseAuth.getInstance().createUser(request);

            // Set the custom role claim immediately
            Map<String, Object> claims = Map.of("role", role);
            FirebaseAuth.getInstance().setCustomUserClaims(userRecord.getUid(), claims);

            System.out.println("Successfully created new user: " + userRecord.getUid() + " with role: " + role);

            Map<String, String> response = new HashMap<>();
            response.put("message", "User created successfully with role " + role);
            response.put("uid", userRecord.getUid());
            return ResponseEntity.status(HttpStatus.CREATED).body(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Error creating user: " + e.getMessage()));
        }
    }

    // --- NEW: Assign Patient to Doctor Endpoint ---
    @PostMapping("/assign-patient")
    public ResponseEntity<String> assignPatient(@RequestBody Map<String, String> payload) {
        try {
            String doctorUid = payload.get("doctorUid");
            String patientUid = payload.get("patientUid");

            Firestore db = FirestoreClient.getFirestore();
            DocumentReference docRef = db.collection("doctor_assignments").document(doctorUid);

            // Use arrayUnion to add the patient to the doctor's list
            docRef.set(Map.of("patientUids", FieldValue.arrayUnion(patientUid)), SetOptions.merge());

            return ResponseEntity.ok("Patient " + patientUid + " assigned to doctor " + doctorUid);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error assigning patient: " + e.getMessage());
        }
    }

    @GetMapping("/assignments")
    public ResponseEntity<List<Map<String, Object>>> getAssignments() throws ExecutionException, InterruptedException {
        Firestore db = FirestoreClient.getFirestore();
        ApiFuture<QuerySnapshot> future = db.collection("doctor_assignments").get();
        List<QueryDocumentSnapshot> documents = future.get().getDocuments();

        // Convert the Firestore documents into a list of maps for the frontend
        List<Map<String, Object>> assignments = documents.stream()
                .map(doc -> Map.of("id", doc.getId(), "data", doc.getData()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(assignments);
    }

    @PostMapping("/set-role")
    public ResponseEntity<String> setRole(@RequestBody Map<String, String> payload) {
        try {
            String uid = payload.get("uid");
            String role = payload.get("role");

            if (!role.equals("doctor") && !role.equals("patient") && !role.equals("admin")) {
                return ResponseEntity.badRequest().body("Invalid role specified.");
            }

            Map<String, Object> claims = Map.of("role", role);
            FirebaseAuth.getInstance().setCustomUserClaims(uid, claims);
            return ResponseEntity.ok("Successfully set role '" + role + "' for user " + uid);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error setting role: " + e.getMessage());
        }
    }

    @PostMapping("/documents/{docId}/toggle-visibility")
    public ResponseEntity<String> setVisibility(@PathVariable String docId, @RequestBody Map<String, Boolean> payload) {
        try {
            boolean isVisible = payload.get("isVisible");
            Firestore db = FirestoreClient.getFirestore();
            db.collection("file_metadata").document(docId).update("isVisibleToPatient", isVisible).get();
            return ResponseEntity.ok("Visibility for doc " + docId + " set to " + isVisible);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error updating visibility: " + e.getMessage());
        }
    }
}