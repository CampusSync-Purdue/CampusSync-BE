import cors from 'cors'
import express from 'express'
import { CORS_ORIGIN } from './config/environment.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestLogger } from './middleware/requestLogger.js'
import authRoutes from './routes/auth.routes.js'
import roomRoutes from './routes/roomRoutes.js'

const app = express()

app.use(requestLogger)
app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  }),
)

app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/rooms', roomRoutes)

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    message: 'CampusSync API is running',
  })
})

app.use(errorHandler)

export default app
