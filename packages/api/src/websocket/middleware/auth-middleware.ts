import { Socket } from 'socket.io'
import { ExtendedError } from 'socket.io/dist/namespace'
import jwt from 'jsonwebtoken'

interface JwtPayload {
  userId: string
  email: string
  iat: number
  exp: number
}

export const authMiddleware = async (
  socket: Socket,
  next: (err?: ExtendedError) => void
): Promise<void> => {
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token

    if (!token) {
      return next(new Error('Authentication required'))
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('[WebSocket Auth] JWT_SECRET not configured')
      return next(new Error('Server configuration error'))
    }

    try {
      const decoded = jwt.verify(token as string, jwtSecret) as JwtPayload

      // Attach user info to socket
      ;(socket as any).userId = decoded.userId
      ;(socket as any).userEmail = decoded.email

      console.log(`[WebSocket Auth] Authenticated user ${decoded.userId}`)
      next()
    } catch (jwtError) {
      console.error('[WebSocket Auth] JWT verification failed:', jwtError)
      return next(new Error('Invalid authentication token'))
    }
  } catch (error) {
    console.error('[WebSocket Auth] Authentication error:', error)
    return next(new Error('Authentication failed'))
  }
}
