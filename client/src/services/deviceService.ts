import { Device } from "@capacitor/device";

export interface DeviceMetadata {
  deviceId: string;
  model: string;
  platform: string;
  osVersion: string;
  manufacturer?: string;
  isVirtual?: boolean;
}

const LOCAL_DEVICE_ID_KEY = "off2field_assigned_device_id";
const LOCAL_DEVICE_META_KEY = "off2field_device_metadata";

/**
 * Generates a standard company inspection device identifier if none exists.
 */
function generateFallbackDeviceId(): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DEV-${rand}`;
}

/**
 * Retrieves the persistent unique Device Identifier for this company-issued inspection hardware.
 * Uses @capacitor/device on Android native, with persistent secure local fallback.
 */
export async function getDeviceId(): Promise<string> {
  // Check local persistent storage first
  try {
    const existing = localStorage.getItem(LOCAL_DEVICE_ID_KEY);
    if (existing && existing.trim()) {
      return existing.trim();
    }
  } catch {
    // ignore
  }

  let determinedId = "";
  try {
    const idResult = await Device.getId();
    if (idResult?.identifier) {
      // Create a clean hardware ref e.g. DEV-XXXX from identifier hash
      const hash = Math.abs(
        idResult.identifier.split("").reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
      ) % 10000;
      determinedId = `DEV-${String(hash).padStart(4, "0")}`;
    }
  } catch {
    // Native plugin not available (e.g. web preview)
  }

  if (!determinedId) {
    determinedId = generateFallbackDeviceId();
  }

  try {
    localStorage.setItem(LOCAL_DEVICE_ID_KEY, determinedId);
  } catch {
    // ignore
  }

  return determinedId;
}

/**
 * Retrieves full device hardware and OS telemetry for registration and audit logs.
 */
export async function getDeviceMetadata(): Promise<DeviceMetadata> {
  const deviceId = await getDeviceId();

  try {
    const info = await Device.getInfo();
    const meta: DeviceMetadata = {
      deviceId,
      model: info.model || "Handheld Terminal",
      platform: info.platform || "android",
      osVersion: info.osVersion || "Android 14",
      manufacturer: info.manufacturer || "Field Mobility Corp",
      isVirtual: info.isVirtual ?? false,
    };
    try {
      localStorage.setItem(LOCAL_DEVICE_META_KEY, JSON.stringify(meta));
    } catch { /**/ }
    return meta;
  } catch {
    // Fallback metadata
    const fallback: DeviceMetadata = {
      deviceId,
      model: navigator.userAgent.includes("Android") ? "Rugged Inspection Tablet" : "Field Mobile Device",
      platform: "android",
      osVersion: "14.0",
      manufacturer: "OFF2FIELD Mobile Corp",
      isVirtual: false,
    };
    return fallback;
  }
}

/**
 * Validates whether the active device is authorized for the given user profile.
 */
export function verifyDeviceBinding(
  userAssignedDeviceId: string | undefined,
  currentDeviceId: string
): { authorized: boolean; reason?: string } {
  // If user has no device assigned yet, the first login can bind this device
  if (!userAssignedDeviceId || userAssignedDeviceId.trim() === "") {
    return { authorized: true };
  }

  // Exact match
  if (userAssignedDeviceId.trim().toUpperCase() === currentDeviceId.trim().toUpperCase()) {
    return { authorized: true };
  }

  return {
    authorized: false,
    reason: `This account is assigned to device ${userAssignedDeviceId}. Current device is ${currentDeviceId}. Please contact your administrator for device reassignment.`,
  };
}
