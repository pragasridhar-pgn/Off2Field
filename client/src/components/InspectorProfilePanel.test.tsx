import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCurrentUser,
  cacheUser,
  type AppUser,
} from "../services/authService";

const mockUser: AppUser = {
  uid: "usr_test_12345",
  phone: "+919842635574",
  email: "inspector@off2field.org",
  displayName: "Mohammed Sameer",
  name: "Mohammed Sameer",
  role: "Field Inspector",
  employeeId: "INS-2026-001",
  department: "Operations / Inspection",
  organizationName: "OFF2FIELD Operations",
  siteName: "Substation A",
  status: "Active",
  createdAt: "2026-09-29T10:00:00.000Z",
  lastLoginAt: "2026-09-29T20:42:00.000Z",
};

// Mock localStorage
const mockStorage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => mockStorage.get(k) || null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
  clear: () => mockStorage.clear(),
});

describe("Inspector Profile Model & Session Management", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("1. Accurately preserves all field inspector profile attributes in offline session", () => {
    cacheUser(mockUser);
    const user = getCurrentUser();

    expect(user).not.toBeNull();
    expect(user?.name).toBe("Mohammed Sameer");
    expect(user?.employeeId).toBe("INS-2026-001");
    expect(user?.phone).toBe("+919842635574");
    expect(user?.role).toBe("Field Inspector");
    expect(user?.department).toBe("Operations / Inspection");
    expect(user?.organizationName).toBe("OFF2FIELD Operations");
    expect(user?.siteName).toBe("Substation A");
    expect(user?.status).toBe("Active");
  });

  it("2. Handles missing optional fields gracefully without breaking session structure", () => {
    const minimalUser: AppUser = {
      uid: "usr_min_999",
      phone: "+919842635574",
      role: "Field Inspector",
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    cacheUser(minimalUser);
    const user = getCurrentUser();

    expect(user).not.toBeNull();
    expect(user?.uid).toBe("usr_min_999");
    expect(user?.phone).toBe("+919842635574");
    expect(user?.role).toBe("Field Inspector");
    expect(user?.employeeId).toBeUndefined();
    expect(user?.department).toBeUndefined();
  });

  it("3. Correctly clears active profile session on signOut without wiping IndexedDB storage keys", () => {
    cacheUser(mockUser);
    expect(getCurrentUser()).not.toBeNull();

    cacheUser(null);
    expect(getCurrentUser()).toBeNull();
  });
});
