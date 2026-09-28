import type { Profile } from "@/types";

/** Cambia la moneda sin alterar el país ni los demás datos del perfil local. */
export function profileWithCurrency(profile: Profile, currency: string): Profile {
  return { ...profile, userCurrency: currency };
}
