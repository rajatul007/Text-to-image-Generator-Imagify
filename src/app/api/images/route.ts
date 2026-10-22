import { route } from "@/lib/api";
import { creationsQuerySchema, listCreations } from "@/lib/queries/images";

export const GET = route({}, async ({ user, query }) => listCreations(user.id, query(creationsQuerySchema)));
