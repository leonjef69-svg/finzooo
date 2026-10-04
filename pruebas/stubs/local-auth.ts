export const AuthenticationType = {
  FACIAL_RECOGNITION: 1,
  IRIS: 2,
  FINGERPRINT: 3,
};

export async function hasHardwareAsync() { return false; }
export async function isEnrolledAsync() { return false; }
export async function supportedAuthenticationTypesAsync() { return []; }
export async function authenticateAsync() { return { success: false }; }
