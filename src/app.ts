import cors from 'cors'
import express from 'express'
import { getAllowedOrigins } from './config/cors.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestLogger } from './middleware/requestLogger.js'
import authRoutes from './routes/authRoutes.js'
import authSessionRoutes from './routes/auth.routes.js'
import roomRoutes from './routes/roomRoutes.js'

const app = express()

app.use(requestLogger)
app.use(
  cors({
    origin: getAllowedOrigins(),
    methods: ['GET', 'POST'],
  }),
)

app.use(express.json())
// Registration (POST /api/auth/register) and session endpoints
// (login, logout, /me) both mount under /api/auth.
app.use('/api/auth', authRoutes)
app.use('/api/auth', authSessionRoutes)
app.use('/api/rooms', roomRoutes)

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    message: 'CampusSync API is running',
  })
})

app.use(errorHandler)

export default app
