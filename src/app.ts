import cors from 'cors'
import express from 'express'
import { getAllowedOrigins } from './config/cors.js'
import authRoutes from './routes/authRoutes.js'
import roomRoutes from './routes/roomRoutes.js'

const app = express()

app.use(
  cors({
    origin: getAllowedOrigins(),
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

export default app