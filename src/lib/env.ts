import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
});

function readEnv() {
  const isTest = process.env.NODE_ENV === "test";

  const MONGODB_URI =
    process.env.MONGODB_URI ??
    (isTest ? "mongodb://127.0.0.1:27017/geneasphere_test_unused" : undefined);

  const JWT_SECRET =
    process.env.JWT_SECRET ??
    (isTest ? "x".repeat(64) : undefined);

  return { MONGODB_URI, JWT_SECRET };
}

export const env = envSchema.parse(readEnv());
