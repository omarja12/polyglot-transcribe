export type LanguageCode = "fr" | "ar" | "en";

export interface LanguageOption {
  code: LanguageCode;
  label: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "fr", label: "Français" },
  { code: "ar", label: "Arabic" },
  { code: "en", label: "English" },
];

export interface UsageInfo {
  used_minutes: number;
  limit_minutes: number;
  remaining_minutes: number;
}
