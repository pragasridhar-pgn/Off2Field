import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  normalizePhoneNumber,
  getCachedUser,
  cacheUser,
  getCurrentUser,
  type AppUser,
} from "./authService";

// Mock localStorage
const mockStorage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => mockStorage.get(k) || null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
  clear: () => mockStorage.clear(),
});

describe("Firebase Phone OTP Authentication & Session Tests", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  describe("1. Phone Number Normalization", () => {
    it("Normalizes 10-digit Indian numbers to E.164 format (+91)", () => {
      expect(normalizePhoneNumber("9876543210")).toBe("+919876543210");
      expect(normalizePhoneNumber("98765 43210")).toBe("+919876543210");
      expect(normalizePhoneNumber("09876543210")).toBe("+919876543210");
    });

    it("Preserves international numbers with existing country code", () => {
      expect(normalizePhoneNumber("+15551234567")).toBe("+15551234567");
      expect(normalizePhoneNumber("+44 7911 123456")).toBe("+447911123456");
      expect(normalizePhoneNumber("+971 50 123 4567")).toBe("+971501234567");
    });

    it("Handles empty and edge-case inputs gracefully", () => {
      expect(normalizePhoneNumber("")).toBe("");
    });
  });

  describe("2. Persistent Offline Session Management", () => {
    it("Caches authenticated user and restores offline session without OTP prompt", () => {
      const now = new Date().toISOString();
      const testUser: AppUser = {
        uid: "TEST-FB-UID-999",
        phone: "+919876543210",
        name: "Field Officer",
        displayName: "Field Officer",
        role: "inspector",
        createdAt: now,
        lastLoginAt: now,
      };

      cacheUser(testUser);
      const cached = getCachedUser();
      expect(cached).not.toBeNull();
      expect(cached?.uid).toBe("TEST-FB-UID-999");
      expect(cached?.phone).toBe("+919876543210");
      expect(cached?.role).toBe("inspector");

      const current = getCurrentUser();
      expect(current?.uid).toBe("TEST-FB-UID-999");
    });

    it("Clears cached session on signOut", () => {
      const now = new Date().toISOString();
      const testUser: AppUser = {
        uid: "TEST-FB-UID-999",
        phone: "+919876543210",
        role: "inspector",
        createdAt: now,
        lastLoginAt: now,
      };

      cacheUser(testUser);
      expect(getCachedUser()).not.toBeNull();

      cacheUser(null);
      expect(getCachedUser()).toBeNull();
    });
  });

  describe("3. Indian Mobile Number & Password Verification Login", () => {
    it("Authenticates registered government officer with correct password", async () => {
      const user = await import("./authService").then(m => m.signInWithPhonePassword("9842635574", "123456"));
      expect(user).toBeDefined();
      expect(user.phone).toBe("+919842635574");
      expect(user.name).toBe("Mohammed Sameer");
      expect(user.role).toBe("Field Inspector");
    });

    it("Denies access when incorrect password is provided", async () => {
      await expect(
        import("./authService").then(m => m.signInWithPhonePassword("9842635574", "wrong"))
      ).rejects.toThrow();
    });

    it("Rejects unregistered phone numbers", async () => {
      await expect(
        import("./authService").then(m => m.signInWithPhonePassword("9999999999", "123456"))
      ).rejects.toThrow("Mobile number or password is incorrect.");
    });
  });
});
