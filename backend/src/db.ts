import { Pool } from "pg";
import dotenv from "dotenv";
import { databaseConfiguration } from "./config/runtime";
import { logServerError } from "./logging";

dotenv.config({ quiet: true });

export const pool = new Pool(databaseConfiguration());
pool.on("error", (error) => logServerError("Idle database connection failed.", error));
