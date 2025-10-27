package com.example.digitallocker.controller;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    // --- NEW: Endpoint to send a general message ---
    @PostMapping("/send")
    public ResponseEntity<String> sendMessage(@RequestBody Map<String, String> payload) {
        try {
            String senderUid = SecurityContextHolder.getContext().getAuthentication().getName();
            String recipientEmail = payload.get("recipientEmail");
            String textMessage = payload.get("textMessage");

            String recipientUid = FirebaseAuth.getInstance().getUserByEmail(recipientEmail).getUid();
            Firestore db = FirestoreClient.getFirestore();

            // Create a consistent ID for the conversation
            List<String> participants = Arrays.asList(senderUid, recipientUid);
            participants.sort(String::compareTo);
            String conversationId = String.join("_", participants);

            DocumentReference conversationRef = db.collection("conversations").document(conversationId);

            // Prepare message data (for general messages)
            Map<String, Object> messageData = new HashMap<>();
            messageData.put("senderUid", senderUid);
            messageData.put("textMessage", textMessage);
            messageData.put("timestamp", FieldValue.serverTimestamp());

            // Add the message to subcollection
            conversationRef.collection("messages").add(messageData);

            // Update main conversation doc
            conversationRef.set(Map.of(
                    "participants", participants,
                    "lastMessage", textMessage,
                    "lastUpdated", FieldValue.serverTimestamp()
            ), SetOptions.merge());

            return ResponseEntity.ok("Message sent successfully.");

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to send message.");
        }
    }

    // --- NEW: Endpoint to get message history for a conversation ---
    @GetMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<List<Map<String, Object>>> getConversationMessages(@PathVariable String conversationId) {
        try {
            String uid = SecurityContextHolder.getContext().getAuthentication().getName();
            Firestore db = FirestoreClient.getFirestore();

            DocumentReference conversationRef = db.collection("conversations").document(conversationId);
            DocumentSnapshot conversationDoc = conversationRef.get().get();

            // Security check: Ensure current user is part of this conversation
            if (!conversationDoc.exists() ||
                    !((List<String>) conversationDoc.get("participants")).contains(uid)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            // Fetch all messages ordered by timestamp
            ApiFuture<QuerySnapshot> future = conversationRef.collection("messages")
                    .orderBy("timestamp", Query.Direction.ASCENDING)
                    .get();

            List<Map<String, Object>> messages = future.get().getDocuments().stream()
                    .map(doc -> {
                        Map<String, Object> data = new HashMap<>(doc.getData());
                        data.put("messageId", doc.getId());
                        return data;
                    })
                    .collect(Collectors.toList());

            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // --- EXISTING: Get list of all conversations ---
    @GetMapping("/conversations")
    public ResponseEntity<List<Map<String, Object>>> getConversations() {
        try {
            String uid = SecurityContextHolder.getContext().getAuthentication().getName();
            Firestore db = FirestoreClient.getFirestore();

            ApiFuture<QuerySnapshot> future = db.collection("conversations")
                    .whereArrayContains("participants", uid)
                    .get();

            List<Map<String, Object>> conversations = future.get().getDocuments().stream()
                    .map(doc -> {
                        Map<String, Object> data = new HashMap<>(doc.getData());
                        data.put("conversationId", doc.getId());
                        return data;
                    })
                    .collect(Collectors.toList());

            return ResponseEntity.ok(conversations);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // --- EXISTING: Share document (unchanged) ---
    @PostMapping("/share")
    public ResponseEntity<String> shareDocument(@RequestBody Map<String, String> payload) {
        try {
            String senderUid = SecurityContextHolder.getContext().getAuthentication().getName();
            String recipientEmail = payload.get("recipientEmail");
            String textMessage = payload.get("textMessage");
            String docId = payload.get("docId");
            String originalFilename = payload.get("originalFilename");

            String recipientUid = FirebaseAuth.getInstance().getUserByEmail(recipientEmail).getUid();
            Firestore db = FirestoreClient.getFirestore();

            // Update file's sharedWith list
            db.collection("file_metadata").document(docId)
                    .update("sharedWith", FieldValue.arrayUnion(recipientUid));

            // Build conversation ID
            List<String> participants = Arrays.asList(senderUid, recipientUid);
            participants.sort(String::compareTo);
            String conversationId = String.join("_", participants);

            DocumentReference conversationRef = db.collection("conversations").document(conversationId);

            // Prepare message with file info
            Map<String, Object> messageData = new HashMap<>();
            messageData.put("senderUid", senderUid);
            messageData.put("textMessage", textMessage);
            messageData.put("docId", docId);
            messageData.put("originalFilename", originalFilename);
            messageData.put("timestamp", FieldValue.serverTimestamp());

            // Add message to conversation
            conversationRef.collection("messages").add(messageData);

            // Update conversation doc
            conversationRef.set(Map.of(
                    "participants", participants,
                    "lastMessage", textMessage,
                    "lastUpdated", FieldValue.serverTimestamp()
            ), SetOptions.merge());

            return ResponseEntity.ok("Document shared successfully.");

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to share document.");
        }
    }
}
