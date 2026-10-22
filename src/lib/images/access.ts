import type { GeneratedImage, Profile } from "@prisma/client";

export interface Viewer {
  id: string;
  role: "USER" | "ADMIN";
}

export function isPubliclyVisible(img: Pick<GeneratedImage, "visibility" | "moderationStatus" | "deletedAt">) {
  return img.visibility === "PUBLIC" && img.moderationStatus === "OK" && img.deletedAt === null;
}

/** Central authorization rule for image bytes and metadata. Enforced server-side on every request. */
export function canViewImage(img: Pick<GeneratedImage, "userId" | "visibility" | "moderationStatus" | "deletedAt">, viewer: Viewer | null) {
  if (img.deletedAt) return false;
  if (viewer && viewer.id === img.userId) return true;
  if (viewer?.role === "ADMIN") return true;
  return isPubliclyVisible(img);
}

export function imageUrls(id: string) {
  return { url: `/api/images/${id}/file`, thumbUrl: `/api/images/${id}/file?variant=thumb`, downloadUrl: `/api/images/${id}/file?download=1` };
}

type ImageWithJob = GeneratedImage & {
  job?: { id: string; modelId: string; modelVersion: string; negativePrompt: string | null; aspectRatio: string | null; quality: string; enhancedPrompt: string | null; prompt: string; type: string; numImages: number; seed: number | null; style: string | null } | null;
};

/** Full representation – only for the owner. Never includes storage keys. */
export function serializeOwnImage(img: ImageWithJob, extras: { favorite?: boolean; shareToken?: string | null } = {}) {
  return {
    id: img.id,
    ...imageUrls(img.id),
    width: img.width,
    height: img.height,
    seed: img.seed,
    prompt: img.prompt,
    style: img.style,
    modelId: img.modelId,
    origin: img.origin,
    parentId: img.parentId,
    jobId: img.jobId,
    visibility: img.visibility,
    showPrompt: img.showPrompt,
    showCreator: img.showCreator,
    moderationStatus: img.moderationStatus,
    likeCount: img.likeCount,
    createdAt: img.createdAt.toISOString(),
    favorite: extras.favorite ?? false,
    shareToken: extras.shareToken ?? null,
    job: img.job
      ? {
          id: img.job.id,
          type: img.job.type,
          modelId: img.job.modelId,
          modelVersion: img.job.modelVersion,
          prompt: img.job.prompt,
          enhancedPrompt: img.job.enhancedPrompt,
          negativePrompt: img.job.negativePrompt,
          aspectRatio: img.job.aspectRatio,
          quality: img.job.quality,
          numImages: img.job.numImages,
          style: img.job.style,
          seed: img.job.seed,
        }
      : null,
  };
}
export type OwnImage = ReturnType<typeof serializeOwnImage>;

type PublicImageInput = GeneratedImage & { user: { name: string; profile: Pick<Profile, "username" | "displayName" | "avatarKey"> | null } };

/** Public representation – respects the creator's prompt/creator visibility choices. */
export function serializePublicImage(img: PublicImageInput, extras: { liked?: boolean } = {}) {
  return {
    id: img.id,
    ...imageUrls(img.id),
    width: img.width,
    height: img.height,
    style: img.style,
    modelId: img.modelId,
    prompt: img.showPrompt ? img.prompt : null,
    seed: img.showPrompt ? img.seed : null,
    creator: img.showCreator && img.user.profile ? { username: img.user.profile.username, displayName: img.user.profile.displayName } : null,
    likeCount: img.likeCount,
    liked: extras.liked ?? false,
    publishedAt: (img.publishedAt ?? img.createdAt).toISOString(),
  };
}
export type PublicImage = ReturnType<typeof serializePublicImage>;
