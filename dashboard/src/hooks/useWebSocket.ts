import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  data: string;
}

export function useWebSocket(url: string | undefined) {
  const socketRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  useEffect(() => {
    if (!url) {
      return;
    }

    setStatus('connecting');
    const socket = new WebSocket(url);
    socketRef.current = socket;

    const handleOpen = () => setStatus('connected');
    const handleClose = () => setStatus('disconnected');
    const handleMessage = (event: WebSocketMessage) => {
      setMessages(prev => [event.data, ...prev].slice(0, 50));
    };

    socket.addEventListener('open', handleOpen);
    socket.addEventListener('close', handleClose);
    socket.addEventListener('message', handleMessage as unknown as EventListener);

    return () => {
      socket.removeEventListener('open', handleOpen);
      socket.removeEventListener('close', handleClose);
      socket.removeEventListener('message', handleMessage as unknown as EventListener);
      socket.close();
    };
  }, [url]);

  return { socket: socketRef.current, messages, status };
}
