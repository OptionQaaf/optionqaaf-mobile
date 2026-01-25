import { Gift, Megaphone, Shield, Sparkles, Star, Tag, type LucideIcon } from "lucide-react-native"

export const SYSTEM_ICON_MAP = {
  Sparkles,
  Megaphone,
  Gift,
  Tag,
  Star,
  Shield,
} as const

export type SystemIconName = keyof typeof SYSTEM_ICON_MAP
