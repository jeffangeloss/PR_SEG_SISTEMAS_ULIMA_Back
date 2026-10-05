import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config/app-config.js";
import * as schema from "./schema/index.js";
import * as relations from "./relations/index.js";

const client = postgres(config.db.url);
export const db = drizzle(client, { schema: { ...schema, ...relations } });
