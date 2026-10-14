import path from "node:path";

const e2eDbPath = path.join(process.cwd(), "prisma", "e2e.db");
export const e2eDatabaseUrl = `file:${e2eDbPath.replace(/\\/g, "/")}`;
