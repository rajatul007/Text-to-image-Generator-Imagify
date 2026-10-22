import Link from "next/link";
import { requirePageUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/account/profile-form";
import { PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requirePageUser("/profile");
  const profile = await db.profile.findUniqueOrThrow({ where: { userId: user.id } });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Profile"
        description={
          <>
            How you appear on images you publish.{" "}
            <Link href={`/explore?creator=${profile.username}`} className="text-violet underline">
              View your public images
            </Link>
          </>
        }
      />
      <ProfileForm initial={{ name: user.name, displayName: profile.displayName, username: profile.username, bio: profile.bio ?? "", email: user.email, avatarUrl: profile.avatarKey ? `/api/avatar/${user.id}` : null }} />
    </div>
  );
}
