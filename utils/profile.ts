import type { Profile } from "@/types";

/** La moneda solo se elige antes de terminar la configuración de la cuenta. */
export function profileWithCurrency(profile: Profile, currency: string): Profile {
  if (profile.hasOnboarded) return profile;
  return { ...profile, userCurrency: currency };
}
