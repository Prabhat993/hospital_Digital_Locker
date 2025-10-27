

package com.example.digitallocker.controller;

import com.example.digitallocker.service.EncryptionService;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.cloud.FirestoreClient;
import com.google.firebase.cloud.StorageClient;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.crypto.SecretKey;
import java.util.*;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final EncryptionService encryptionService;

    public FileController(EncryptionService encryptionService) {
        this.encryptionService = encryptionService;
    }

    @GetMapping("/list")
    public ResponseEntity<List<Map<String, Object>>> listFiles() throws ExecutionException, InterruptedException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String uid = authentication.getName();
        String role = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .findFirst().orElse("");

        Firestore db = FirestoreClient.getFirestore();
        Map<String, Map<String, Object>> filesMap = new HashMap<>();

        switch (role) {
            case "ROLE_admin":
                Query adminQuery = db.collection("file_metadata");
                for (DocumentSnapshot document : adminQuery.get().get().getDocuments()) {
                    addFileToMap(filesMap, document, "admin"); // Pass role as access type
                }
                break;
            case "ROLE_patient":
                Query patientQuery = db.collection("file_metadata")
                        .whereEqualTo("ownerUid", uid)
                        .whereEqualTo("isVisibleToPatient", true);
                for (DocumentSnapshot document : patientQuery.get().get().getDocuments()) {
                    addFileToMap(filesMap, document, "patient"); // Pass role as access type
                }
                break;
            case "ROLE_doctor":
                // Query 1: Get files from assigned patients
                DocumentSnapshot doctorDoc = db.collection("doctor_assignments").document(uid).get().get();
                if (doctorDoc.exists()) {
                    List<String> patientUids = (List<String>) doctorDoc.get("patientUids");
                    if (patientUids != null && !patientUids.isEmpty()) {
                        Query assignedPatientQuery = db.collection("file_metadata").whereIn("ownerUid", patientUids);
                        for (DocumentSnapshot document : assignedPatientQuery.get().get().getDocuments()) {
                            // Mark these files as 'assigned'
                            addFileToMap(filesMap, document, "assigned");
                        }
                    }
                }

                // Query 2: Get files shared directly with the doctor
                ApiFuture<QuerySnapshot> sharedFilesFuture = db.collection("file_metadata").whereArrayContains("sharedWith", uid).get();
                for (DocumentSnapshot document : sharedFilesFuture.get().getDocuments()) {
                    // Mark these files as 'shared'
                    addFileToMap(filesMap, document, "shared");
                }
                break;
            default:
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(new ArrayList<>(filesMap.values()));
    }

    // UPDATED Helper method to include the accessType
    private void addFileToMap(Map<String, Map<String, Object>> filesMap, DocumentSnapshot document, String accessType) {
        String docId = document.getId();
        if (!filesMap.containsKey(docId)) {
            Map<String, Object> fileData = new HashMap<>();
            fileData.put("docId", docId);
            fileData.put("originalFilename", document.getString("originalFilename"));
            fileData.put("ownerUid", document.getString("ownerUid"));
            Boolean isVisible = document.getBoolean("isVisibleToPatient");
            fileData.put("isVisibleToPatient", isVisible != null ? isVisible : true);
            fileData.put("accessType", accessType); // Add the new flag
            filesMap.put(docId, fileData);
        }
    }



    // PASTE THIS ENTIRE METHOD INTO YOUR FileController.java
    // In FileController.java

    @GetMapping("/{docId}/download")
    public ResponseEntity<byte[]> downloadFile(@PathVariable String docId) { // Removed 'throws Exception'
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String uid = authentication.getName();
        String role = authentication.getAuthorities().stream()
                .findFirst()
                .map(GrantedAuthority::getAuthority)
                .orElse("");

        Firestore db = FirestoreClient.getFirestore();
        Storage storage = StorageClient.getInstance().bucket().getStorage();

        try { // START of try block
            // Fetch metadata
            DocumentSnapshot doc = db.collection("file_metadata").document(docId).get().get();
            if (!doc.exists()) {
                System.err.println("Download Error: Document not found - " + docId);
                return ResponseEntity.notFound().build();
            }

            String ownerUid = doc.getString("ownerUid");

            // ----------------------------
            // Authorization via switch(role)
            // ----------------------------
            boolean isAllowed = false;

            switch (role) {
                // IMPORTANT: As you requested, exact case "ROLE_admin" is used here
                case "ROLE_admin":
                    // Admin always allowed (adjust if you need more checks)
                    isAllowed = true;
                    break;

                case "ROLE_patient":
                    // Patients can download their own document only if visible to patients
                    // Field: isVisibleToPatient (Boolean). If missing, default to true.
                    Boolean isVisibleToPatient = doc.getBoolean("isVisibleToPatient");
                    boolean visibleToPatient = (isVisibleToPatient != null) ? isVisibleToPatient : true;
                    isAllowed = uid.equals(ownerUid) && visibleToPatient;
                    break;

                case "ROLE_doctor":
                    /*
                     Doctor logic:
                      - Prefer explicit allowed list: "allowedDoctorUids" (array of UIDs).
                      - Fallback to boolean flag "isVisibleToDoctor" (default true).
                      - You can replace this with your actual relationship check (e.g. consult mapping of patient<->doctor).
                     */
                    boolean allowedByList = false;
                    Object allowedObj = doc.get("allowedDoctorUids");
                    if (allowedObj instanceof List) {
                        @SuppressWarnings("unchecked")
                        List<String> allowedDoctorUids = (List<String>) allowedObj;
                        allowedByList = allowedDoctorUids.stream().anyMatch(Objects::nonNull)
                                && allowedDoctorUids.contains(uid);
                    }
                    Boolean isVisibleToDoctor = doc.getBoolean("isVisibleToDoctor");
                    boolean visibleToDoctor = (isVisibleToDoctor != null) ? isVisibleToDoctor : true;

                    isAllowed = allowedByList || visibleToDoctor;
                    break;

                default:
                    // Other roles - by default deny. Adjust for other roles if needed.
                    isAllowed = false;
            }

            if (!isAllowed) {
                System.err.println("Download Error: User " + uid + " forbidden to access doc " + docId + " (role=" + role + ")");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }

            // ----------------------------
            // Fetch encryption metadata
            // ----------------------------
            String wrappedAesKey = doc.getString("wrappedAesKey");
            byte[] iv = Base64.getDecoder().decode(doc.getString("iv"));
            String storagePath = doc.getString("storagePath");

            // Fetch file from Firebase Storage
            Blob blob = storage.get(StorageClient.getInstance().bucket().getName(), storagePath);
            if (blob == null) {
                System.err.println("Download Error: Blob not found in storage - " + storagePath);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }

            byte[] encryptedFileBytes = blob.getContent();

            // 🔓 Decrypt the file
            SecretKey aesKey = encryptionService.unwrapAesKey(wrappedAesKey);
            EncryptionService.EncryptedData encryptedData =
                    new EncryptionService.EncryptedData(encryptedFileBytes, iv);
            byte[] decryptedFileBytes = encryptionService.decryptFile(encryptedData, aesKey);

            System.out.println("✅ Successfully decrypted file: " + doc.getString("originalFilename"));

            String filename = doc.getString("originalFilename");
            String contentType = "application/octet-stream"; // Default type

            // Optional: Infer MIME type based on filename
            if (filename != null && filename.contains(".")) {
                String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
                switch (ext) {
                    case "pdf":
                        contentType = "application/pdf";
                        break;
                    case "jpg":
                    case "jpeg":
                        contentType = "image/jpeg";
                        break;
                    case "png":
                        contentType = "image/png";
                        break;
                    case "txt":
                        contentType = "text/plain";
                        break;
                    case "doc":
                    case "docx":
                        contentType = "application/msword";
                        break;
                    default:
                        contentType = "application/octet-stream";
                }
            }

            // ✅ Return decrypted file
            return ResponseEntity.ok()
                    .contentType(org.springframework.http.MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                    .body(decryptedFileBytes);

        } catch (Exception e) {
            System.err.println("❌ Download failed for docId: " + docId);
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } // END of try block
    }






    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("patientEmail") String patientEmail) { // <-- CHANGED from patientUid to patientEmail
        try {
            // The uploader is the authenticated user (admin or doctor)
            String uploaderUid = SecurityContextHolder.getContext().getAuthentication().getName();

            // NEW: Look up the patient's UID by their email
            String patientUid = FirebaseAuth.getInstance().getUserByEmail(patientEmail).getUid();
            System.out.println("Upload by: " + uploaderUid + " for patient: " + patientEmail + " (UID: " + patientUid + ")");

            // The rest of the logic is the same, using the found patientUid as the owner
            SecretKey aesKey = encryptionService.generateAesKey();
            EncryptionService.EncryptedData encryptedData = encryptionService.encryptFile(aesKey, file.getBytes());
            String wrappedAesKey = encryptionService.wrapAesKey(aesKey);
            String docId = UUID.randomUUID().toString();
            String storagePath = "encrypted_files/" + docId;
            Storage storage = StorageClient.getInstance().bucket().getStorage();
            BlobId blobId = BlobId.of(StorageClient.getInstance().bucket().getName(), storagePath);
            BlobInfo blobInfo = BlobInfo.newBuilder(blobId).setContentType("application/octet-stream").build();
            storage.create(blobInfo, encryptedData.ciphertext());

            Firestore db = FirestoreClient.getFirestore();
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("ownerUid", patientUid);
            metadata.put("originalFilename", file.getOriginalFilename());
            // ... (rest of the metadata is the same)
            metadata.put("storagePath", storagePath);
            metadata.put("wrappedAesKey", wrappedAesKey);
            metadata.put("iv", Base64.getEncoder().encodeToString(encryptedData.iv()));
            metadata.put("createdAt", com.google.cloud.Timestamp.now());
            metadata.put("isVisibleToPatient", true);

            db.collection("file_metadata").document(docId).set(metadata).get();

            Map<String, String> response = new HashMap<>();
            response.put("message", "File uploaded successfully for patient " + patientEmail);
            response.put("docId", docId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to upload file. Check if patient email is correct."));
        }
    }
}