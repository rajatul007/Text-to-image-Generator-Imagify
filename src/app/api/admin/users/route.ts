import { route } from "@/lib/api";
import { adminUsersQuery, searchUsers } from "@/lib/queries/admin-users";

export const GET = route({ auth: "admin" }, async ({ query }) => searchUsers(query(adminUsersQuery)));
