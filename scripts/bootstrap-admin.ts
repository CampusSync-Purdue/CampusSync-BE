import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { pool } from '../src/config/database.js'
import { db } from '../src/db/index.js'
import { users } from '../src/db/schema.js'

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
const name = process.env.ADMIN_NAME

if (!email || !password || !name) {
  throw new Error(
    'ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME must be set before running the admin bootstrap.',
  )
}

async function bootstrapAdmin(): Promise<void> {
  try {
    const [existingAdmin] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1)

    if (existingAdmin) {
      console.log(`An administrator already exists: ${existingAdmin.email}`)
      return
    }

    const passwordHash = await bcrypt.hash(password!, 12)

    const [admin] = await db
      .insert(users)
      .values({
        name: name!.trim(),
        email: email!.trim().toLowerCase(),
        passwordHash,
        role: 'admin',
      })
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role })

    console.log('Administrator created successfully:')
    console.log(admin)
  } finally {
    await pool.end()
  }
}

bootstrapAdmin().catch((error) => {
  console.error('Failed to bootstrap administrator:', error)
  process.exitCode = 1
})
