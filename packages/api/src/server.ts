import { createServer } from 'http'
import app from './app.js'
import { initializeWebSocketServer } from './websocket/websocket-server.js'

const PORT = process.env.PORT || 3000

// Create HTTP server
const httpServer = createServer(app)

// Initialize WebSocket server
const wsServer = initializeWebSocketServer(httpServer)

const server = httpServer.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`)
  console.log(`🏥 Health check available at http://localhost:${PORT}/health`)
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`)
  console.log(`🔌 WebSocket server available at ws://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  wsServer.shutdown()
  server.close(() => {
    console.log('Process terminated')
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  wsServer.shutdown()
  server.close(() => {
    console.log('Process terminated')
  })
})

export default server
