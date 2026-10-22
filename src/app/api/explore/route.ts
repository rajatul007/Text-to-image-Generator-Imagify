import { route } from "@/lib/api";
import { RULES } from "@/lib/rate-limit";
import { exploreQuerySchema, listExplore } from "@/lib/queries/images";

export const GET = route({ auth: "optional", rateLimit: RULES.publicApi }, async ({ user, query }) => listExplore(user?.id ?? null, query(exploreQuerySchema)));
