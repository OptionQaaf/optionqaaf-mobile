import type { PopupAudience, PopupPayload, StoredPopup } from "../../types/popup"
export type { PopupPayload, StoredPopup } from "../../types/popup"

export type ViewerAudience = "authenticated" | "guest"

export function resolveViewerAudience(viewerKey: string): ViewerAudience {
	return viewerKey.startsWith("user:") ? "authenticated" : "guest"
}

export function isAudienceMatch(audience: PopupAudience | undefined, viewer: ViewerAudience): boolean {
	if (!audience || audience === "all") return true
	return audience === viewer
}

export function compareVersionStrings(current: string, required: string): number {
	const left = current.split(".").map((segment) => Number.parseInt(segment, 10))
	const right = required.split(".").map((segment) => Number.parseInt(segment, 10))
	for (let i = 0; i < Math.max(left.length, right.length); i++) {
		const lv = Number.isFinite(left[i]) ? left[i] : 0
		const rv = Number.isFinite(right[i]) ? right[i] : 0
		if (lv > rv) return 1
		if (lv < rv) return -1
	}
	return 0
}

export function meetsMinimumVersion(current: string | undefined, required?: string): boolean {
	if (!required) return true
	if (!current) return false
	return compareVersionStrings(current, required) >= 0
}
