package com.example.digitallocker.service;

import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.*;
import java.security.cert.Certificate;
import java.util.Base64;

@Service
public class EncryptionService {

    private final PrivateKey privateKey;
    private final PublicKey publicKey;

    // A simple record to hold the encrypted data and its IV
    public record EncryptedData(byte[] ciphertext, byte[] iv) {}

    public EncryptionService() {
        // NOTE: For production, these secrets should be loaded from a secure vault or environment variables
        String keystorePassword = "changeit";
        String keyPassword = "changeit";
        String keyAlias = "locker-key";

        try {
            KeyStore ks = KeyStore.getInstance("JKS");
            try (InputStream is = new FileInputStream("keystore.jks")) {
                ks.load(is, keystorePassword.toCharArray());
            }
            this.privateKey = (PrivateKey) ks.getKey(keyAlias, keyPassword.toCharArray());
            Certificate cert = ks.getCertificate(keyAlias);
            this.publicKey = cert.getPublicKey();
            System.out.println("Keystore loaded successfully!");
        } catch (Exception e) {
            throw new RuntimeException("Failed to load keystore and keys", e);
        }
    }

    // Generates a new, random AES-256 key for each file
    public SecretKey generateAesKey() throws NoSuchAlgorithmException {
        KeyGenerator keyGenerator = KeyGenerator.getInstance("AES");
        keyGenerator.init(256);
        return keyGenerator.generateKey();
    }

    // Encrypts the file data with the given AES key
    public EncryptedData encryptFile(SecretKey aesKey, byte[] fileData) throws Exception {
        byte[] iv = new byte[12]; // 12 bytes for GCM is standard
        new SecureRandom().nextBytes(iv);
        GCMParameterSpec gcmParameterSpec = new GCMParameterSpec(128, iv);

        Cipher aesCipher = Cipher.getInstance("AES/GCM/NoPadding");
        aesCipher.init(Cipher.ENCRYPT_MODE, aesKey, gcmParameterSpec);

        byte[] ciphertext = aesCipher.doFinal(fileData);
        return new EncryptedData(ciphertext, iv);
    }

    // Encrypts (wraps) the AES key with our master public RSA key
    public String wrapAesKey(SecretKey aesKey) throws Exception {
        Cipher rsaCipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
        rsaCipher.init(Cipher.ENCRYPT_MODE, this.publicKey);
        byte[] wrappedKey = rsaCipher.doFinal(aesKey.getEncoded());
        return Base64.getEncoder().encodeToString(wrappedKey);
    }

    // Decrypts (unwraps) the AES key with our master private RSA key
    public SecretKey unwrapAesKey(String wrappedKeyBase64) throws Exception {
        byte[] wrappedKeyBytes = Base64.getDecoder().decode(wrappedKeyBase64);
        // THIS IS THE CORRECTED LINE
        Cipher rsaCipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
        rsaCipher.init(Cipher.DECRYPT_MODE, this.privateKey);
        byte[] aesKeyBytes = rsaCipher.doFinal(wrappedKeyBytes);
        return new SecretKeySpec(aesKeyBytes, "AES");
    }

    // Decrypts the file data with the given AES key
    public byte[] decryptFile(EncryptedData encryptedData, SecretKey aesKey) throws Exception {
        GCMParameterSpec gcmParameterSpec = new GCMParameterSpec(128, encryptedData.iv());
        Cipher aesCipher = Cipher.getInstance("AES/GCM/NoPadding");
        aesCipher.init(Cipher.DECRYPT_MODE, aesKey, gcmParameterSpec);
        return aesCipher.doFinal(encryptedData.ciphertext());
    }
}