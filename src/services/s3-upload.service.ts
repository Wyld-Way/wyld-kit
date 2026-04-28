// S3 direct-upload helper. Browser uploads file → S3 → returns the
// filename (NOT the full URL — backends in this ecosystem store the
// filename and resolve the public URL on read via *_link fields).
//
// Why aws-sdk v2: matches existing pattern in rewyld + wyldwalk so
// behavior, error shape, and bucket conventions stay consistent
// across the ecosystem. v3 migration is a separate concern.
//
// Folder constants match backend storage conventions — uploads under
// /uploads/<entity_type>/. Backends know how to resolve filenames
// from these prefixes; don't deviate.

// We import lazily so the heavy aws-sdk bundle only ships when an
// app actually consumes the upload service. App-level tree-shaking
// can drop this module entirely if not imported.

export const FOLDERS = {
  GUIDE_PHOTOS: 'uploads/guide_photos',
  GUIDE_COVER: 'uploads/guide_cover_photo',
  PROFILE_PHOTOS: 'uploads/profile_photos',
  EVENT_IMAGES: 'uploads/events',
} as const

export type S3Folder = (typeof FOLDERS)[keyof typeof FOLDERS]

export interface S3UploadConfig {
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

export interface S3UploadService {
  /** True when all required env values are present. */
  isConfigured: boolean
  /**
   * Upload a Blob/File to S3 under the given folder. Returns the
   * generated filename only (not the full URL). Throws if the service
   * isn't configured or the upload fails.
   */
  upload(file: Blob, folder: S3Folder | string): Promise<string>
}

/**
 * Factory: pass AWS config (typically read from
 * NEXT_PUBLIC_AWS_* env vars). When env values are unset, returns
 * a service whose `isConfigured` flag is false — UI should hide
 * upload affordances until env lands rather than throwing.
 *
 * Usage:
 *   const uploader = createS3UploadService({
 *     region: process.env.NEXT_PUBLIC_AWS_S3_REGION_NAME,
 *     accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
 *     secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
 *     bucket: process.env.NEXT_PUBLIC_AWS_STORAGE_BUCKET_NAME,
 *   })
 *   if (!uploader.isConfigured) return null  // hide button
 *   const filename = await uploader.upload(file, FOLDERS.GUIDE_COVER)
 */
export function createS3UploadService(
  config: Partial<S3UploadConfig>
): S3UploadService {
  const isConfigured = Boolean(
    config.region &&
      config.accessKeyId &&
      config.secretAccessKey &&
      config.bucket
  )

  return {
    isConfigured,

    async upload(file, folder) {
      if (!isConfigured) {
        throw new Error(
          'S3 upload is not configured. Set NEXT_PUBLIC_AWS_S3_REGION_NAME, NEXT_PUBLIC_AWS_ACCESS_KEY_ID, NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY, NEXT_PUBLIC_AWS_STORAGE_BUCKET_NAME.'
        )
      }

      // Lazy import keeps aws-sdk out of the bundle for apps that
      // don't actually call upload().
      const { default: AWS } = await import('aws-sdk')

      AWS.config.update({
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      })
      const s3 = new AWS.S3()

      const ext = file.type?.split('/')?.[1] || 'jpg'
      // Collision-safe key: timestamp + 7 chars of entropy. Two
      // parallel uploads of the same file produce distinct keys.
      const entropy = Math.random().toString(36).slice(2, 9)
      const filename = `${Date.now()}-${entropy}.${ext}`

      await s3
        .putObject({
          Bucket: config.bucket as string,
          Key: `${folder}/${filename}`,
          Body: file,
          ContentType: file.type,
        })
        .promise()

      return filename
    },
  }
}
