import { z } from "zod";
import { route } from "@/lib/api";
import { env } from "@/lib/env";
import { createShareLink, revokeShareLinks } from "@/lib/images/manage";

export const POST = route({}, async ({ user, params, json }) => {
  const opts = await json(z.object({ showPrompt: z.boolean().default(true), showCreator: z.boolean().default(true) }));
  const link = await createShareLink(user.id, params.id, opts);
  return { token: link.token, url: `${env().APP_URL}/share/${link.token}`, showPrompt: link.showPrompt, showCreator: link.showCreator };
});

export const DELETE = route({}, async ({ user, params }) => {
  const revoked = await revokeShareLinks(user.id, params.id);
  return { revoked };
});
