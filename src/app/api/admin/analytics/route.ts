import { route } from "@/lib/api";
import { adminAnalytics } from "@/lib/queries/admin";

export const GET = route({ auth: "admin" }, async () => adminAnalytics());
