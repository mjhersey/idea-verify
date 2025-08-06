import { Socket } from 'socket.io';

interface Connection {
  socketId: string;
  userId: string;
  socket: Socket;
  connectedAt: Date;
  lastActivity: Date;
  rooms: Set<string>;
}

export class ConnectionManager {
  private connections: Map<string, Connection>;
  private userConnections: Map<string, Set<string>>;

  constructor() {
    this.connections = new Map();
    this.userConnections = new Map();
  }

  addConnection(socketId: string, userId: string, socket: Socket): void {
    const connection: Connection = {
      socketId,
      userId,
      socket,
      connectedAt: new Date(),
      lastActivity: new Date(),
      rooms: new Set()
    };

    this.connections.set(socketId, connection);

    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(socketId);

    console.log(`[ConnectionManager] Added connection ${socketId} for user ${userId}`);
  }

  removeConnection(socketId: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      // Remove from user connections
      const userConnections = this.userConnections.get(connection.userId);
      if (userConnections) {
        userConnections.delete(socketId);
        if (userConnections.size === 0) {
          this.userConnections.delete(connection.userId);
        }
      }

      this.connections.delete(socketId);
      console.log(`[ConnectionManager] Removed connection ${socketId}`);
    }
  }

  getConnection(socketId: string): Connection | undefined {
    return this.connections.get(socketId);
  }

  getUserConnections(userId: string): Connection[] {
    const socketIds = this.userConnections.get(userId);
    if (!socketIds) return [];

    return Array.from(socketIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is Connection => conn !== undefined);
  }

  updateActivity(socketId: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  addToRoom(socketId: string, room: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.rooms.add(room);
    }
  }

  removeFromRoom(socketId: string, room: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.rooms.delete(room);
    }
  }

  getRoomConnections(room: string): Connection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.rooms.has(room));
  }

  getTotalConnections(): number {
    return this.connections.size;
  }

  getTotalUsers(): number {
    return this.userConnections.size;
  }

  getConnectionStats(): {
    totalConnections: number;
    totalUsers: number;
    connectionsPerUser: Map<string, number>;
  } {
    const connectionsPerUser = new Map<string, number>();
    this.userConnections.forEach((socketIds, userId) => {
      connectionsPerUser.set(userId, socketIds.size);
    });

    return {
      totalConnections: this.connections.size,
      totalUsers: this.userConnections.size,
      connectionsPerUser
    };
  }

  // Cleanup inactive connections
  cleanupInactive(maxInactivityMs: number = 5 * 60 * 1000): void {
    const now = new Date();
    const toRemove: string[] = [];

    this.connections.forEach((connection, socketId) => {
      const inactivityMs = now.getTime() - connection.lastActivity.getTime();
      if (inactivityMs > maxInactivityMs) {
        toRemove.push(socketId);
      }
    });

    toRemove.forEach(socketId => {
      const connection = this.connections.get(socketId);
      if (connection) {
        connection.socket.disconnect();
        this.removeConnection(socketId);
      }
    });

    if (toRemove.length > 0) {
      console.log(`[ConnectionManager] Cleaned up ${toRemove.length} inactive connections`);
    }
  }

  disconnectAll(): void {
    this.connections.forEach(connection => {
      connection.socket.disconnect();
    });
    this.connections.clear();
    this.userConnections.clear();
    console.log('[ConnectionManager] Disconnected all connections');
  }

  // Start periodic cleanup
  startCleanupInterval(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
      this.cleanupInactive();
    }, intervalMs);
  }
}