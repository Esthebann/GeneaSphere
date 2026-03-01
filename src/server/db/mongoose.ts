import mongoose from 'mongoose'

declare global {
  var __MONGOOSE_CONN__: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined
}

const cached = global.__MONGOOSE_CONN__ ?? { conn: null, promise: null }
global.__MONGOOSE_CONN__ = cached

export async function connectDb() {
  if (cached.conn) return cached.conn

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      autoIndex: true
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}
