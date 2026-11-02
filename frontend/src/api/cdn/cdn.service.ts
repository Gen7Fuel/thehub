import { cdnApi } from './cdn.api'

export const cdnService = {
  downloadImage(url: string) {
    return cdnApi.downloadImage(url)
  },
  uploadAuditPhoto(input: FormData) {
    return cdnApi.upload(input, { auth: false })
  },
  uploadBase64Image(base64Data: string | null, fileName: string) {
    return cdnApi.uploadBase64(base64Data, fileName, {})
  },
}
