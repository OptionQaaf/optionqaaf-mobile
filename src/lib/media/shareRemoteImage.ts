import { Share } from "react-native"

type ShareRemoteImageParams = {
  imageUrl: string
  title?: string
}

export async function shareRemoteImage({ imageUrl, title }: ShareRemoteImageParams): Promise<void> {
  if (typeof FileReader === "undefined") {
    throw new Error("Unable to prepare image")
  }

  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error("Image download failed")
  }

  const blob = await response.blob()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result === "string") resolve(result)
      else reject(new Error("Failed to read image data"))
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

  await Share.share({ title, url: dataUrl })
}
