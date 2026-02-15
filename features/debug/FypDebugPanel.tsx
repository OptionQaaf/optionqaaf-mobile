import { FYP_DEBUG, getFypDebugPanelState } from "@/features/debug/fypDebug"
import { PressableOverlay } from "@/ui/interactive/PressableOverlay"
import * as Clipboard from "expo-clipboard"
import { useState } from "react"
import { Modal, ScrollView, Text, View } from "react-native"

export function FypDebugPanel({ side = "right" }: { side?: "left" | "right" }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const snapshot = getFypDebugPanelState()

  if (!FYP_DEBUG) return null

  return (
    <>
      <View className={`absolute ${side === "right" ? "right-4" : "left-4"} bottom-24 z-50`}>
        <PressableOverlay onPress={() => setOpen(true)} className="rounded-full bg-black/80 px-3 py-2">
          <Text className="text-[11px] font-semibold text-white">FYP Console</Text>
        </PressableOverlay>
      </View>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 bg-black/45 justify-end">
          <View className="max-h-[78%] rounded-t-2xl bg-white px-4 pb-6 pt-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[16px] font-bold text-slate-900">FYP Debug Console</Text>
              <View className="flex-row items-center gap-2">
                <PressableOverlay
                  onPress={async () => {
                    const payload = JSON.stringify(snapshot ?? null, null, 2)
                    await Clipboard.setStringAsync(payload)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1200)
                  }}
                  className="rounded-md bg-slate-900 px-2 py-1"
                >
                  <Text className="text-[12px] font-semibold text-white">{copied ? "Copied" : "Copy All"}</Text>
                </PressableOverlay>
                <PressableOverlay onPress={() => setOpen(false)} className="rounded-md bg-slate-100 px-2 py-1">
                  <Text className="text-[12px] font-semibold text-slate-700">Close</Text>
                </PressableOverlay>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator>
              <DebugBlock title="GRID_RANK_TOP15" value={snapshot.gridRankTop15} />
              <DebugBlock title="REEL_SIMILARITY_TOP10" value={snapshot.reelSimilarityTop10} />
              <DebugBlock title="PROFILE_TOP_SIGNALS" value={snapshot.profileTopSignals} />
              <DebugBlock title="REEL_RETRIEVAL_COUNTS" value={snapshot.reelRetrievalCounts} />
              <DebugBlock title="RAW_PRODUCT_PAYLOADS" value={snapshot.rawProductPayloads} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

function DebugBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <View className="mb-4 rounded-lg bg-slate-100 px-3 py-2">
      <Text className="mb-1 text-[12px] font-bold text-slate-800">{title}</Text>
      <Text className="font-mono text-[11px] text-slate-700">{JSON.stringify(value ?? null, null, 2)}</Text>
    </View>
  )
}
