import app from './app.js'

const PORT = process.env.PORT || 3000

const server = app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`)
  console.log(`🏥 Health check available at http://localhost:${PORT}/health`)
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Process terminated')
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  server.close(() => {
    console.log('Process terminated')
  })
})

export default server