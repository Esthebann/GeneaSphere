import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { registerUser, loginUser } from '@/server/services/authService'
import { UserModel } from '@/server/models/User'

jest.setTimeout(30000)

let mongod: MongoMemoryServer

async function clearDb() {
  const collections = await mongoose.connection.db.collections()
  for (const c of collections) {
    await c.deleteMany({})
  }
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongod.getUri('geneasphere_test')
  process.env.JWT_SECRET = 'test_secret'
  process.env.JWT_EXPIRES_IN = '24h'

  await mongoose.connect(process.env.MONGODB_URI)
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  await clearDb()
})

test('first registered user becomes ADMIN and validated', async () => {
  const u1 = await registerUser('admin@test.com', 'password123')
  expect(u1.role).toBe('ADMIN')
  expect(u1.isValidated).toBe(true)

  const u2 = await registerUser('user@test.com', 'password123')
  expect(u2.role).toBe('PENDING')
  expect(u2.isValidated).toBe(false)
})

test('cannot login if not validated', async () => {
  await registerUser('admin@test.com', 'password123')
  await registerUser('user@test.com', 'password123')

  await expect(loginUser('user@test.com', 'password123')).rejects.toThrow('NOT_VALIDATED')
})

test('validated user can login and receives token', async () => {
  await registerUser('admin@test.com', 'password123')
  const pending = await registerUser('user@test.com', 'password123')

  await UserModel.updateOne({ _id: pending.id }, { $set: { role: 'USER', isValidated: true } })

  const res = await loginUser('user@test.com', 'password123')
  expect(typeof res.token).toBe('string')
  expect(res.token.length).toBeGreaterThan(20)
})
