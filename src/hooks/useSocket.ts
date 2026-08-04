import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      setConnected(true);
      const username = localStorage.getItem('equipment-tracker-username') || 'anonymous';
      socket.emit('user:register', {
        alias: username,
        displayName: username,
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('users:list', (users: string[]) => {
      setConnectedUsers(users);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  return { socket: socketRef.current, connected, connectedUsers };
}
