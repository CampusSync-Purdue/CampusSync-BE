import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from '../src/config/database.js'

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
    const existingAdmin = await pool.query(
      "SELECT id, email FROM users WHERE role = 'admin' LIMIT 1",
    )

    if (existingAdmin.rowCount && existingAdmin.rowCount > 0) {
      console.log(`An administrator already exists: ${existingAdmin.rows[0].email}`)
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, name, email, role`,
      [name.trim(), email.trim().toLowerCase(), passwordHash],
    )

    console.log('Administrator created successfully:')
    console.log(result.rows[0])
  } finally {
    await pool.end()
  }
}

bootstrapAdmin().catch((error) => {
  console.error('Failed to bootstrap administrator:', error)
  process.exitCode = 1
})