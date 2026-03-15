import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer | null = null;

export async function startMemoryMongo() {
  mongod = await MongoMemoryServer.create();

  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "x".repeat(64);

  const { connectDb } = await import("@/lib/db");
  await connectDb();
}

export async function stopMemoryMongo() {
  try {
    await mongoose.connection.dropDatabase();
  } catch {}

  try {
    await mongoose.disconnect();
  } catch {}

  if (mongod) await mongod.stop();
  mongod = null;

  (global as any).__mongooseCache = { conn: null, promise: null };
}

export async function clearCollections() {
  const db = mongoose.connection.db;
  if (!db) return;
  const cols = await db.collections();
  for (const c of cols) await c.deleteMany({});
}
