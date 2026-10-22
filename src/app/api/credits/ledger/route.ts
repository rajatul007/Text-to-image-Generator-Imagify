import { route } from "@/lib/api";
import { ledgerQuerySchema, listLedger } from "@/lib/queries/credits";

export const GET = route({}, async ({ user, query }) => listLedger(user.id, query(ledgerQuerySchema)));
