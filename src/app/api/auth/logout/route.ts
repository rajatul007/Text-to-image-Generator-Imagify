import { route } from "@/lib/api";
import { destroyCurrentSession } from "@/lib/auth/session";

export const POST = route({ auth: "optional" }, async () => {
  await destroyCurrentSession();
  return { ok: true };
});
