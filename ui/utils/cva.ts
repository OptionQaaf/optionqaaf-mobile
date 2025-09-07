import { cva, type VariantProps } from "class-variance-authority"
export { cva, type VariantProps }

export function cn(...inputs: Array<string | undefined | false | null>) {
  return inputs.filter(Boolean).join(" ")
}
