import cors from 'cors'
import express from 'express'
import roomRoutes from './routes/roomRoutes.js'

const app = express()

app.use(
  cors({
    origin: 'http://localhost:5173',
  }),
)

app.use(express.json())
app.use('/api/rooms', roomRoutes)

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    message: 'CampusSync API is running',
  })
})

export default app