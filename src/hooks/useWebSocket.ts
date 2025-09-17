import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeUpdate, WebSocketConfig } from '@/types';
import { useNotifications } from '@/store';

interface UseWebSocketOptions {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (data: RealtimeUpdate) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  lastMessage: RealtimeUpdate | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;
  connectionAttempts: number;
}

const useWebSocket = (options: UseWebSocketOptions): UseWebSocketReturn => {
  const {
    url,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoConnect = true,
  } = options;

  const { addNotification } = useNotifications();
  
  // 状态管理
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<RealtimeUpdate | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);

  // 连接WebSocket
  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    
    // 如果已经连接或正在连接，直接返回
    if (wsRef.current?.readyState === WebSocket.CONNECTING || 
        wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    
    try {
      // 创建新的WebSocket连接
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = (event) => {
        if (!mountedRef.current) return;
        
        console.log('WebSocket connected:', event);
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionAttempts(0);
        reconnectAttemptsRef.current = 0;
        
        // 清除重连定时器
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // 触发连接回调
        if (onConnect) {
          onConnect();
        }

        // 显示连接成功通知
        addNotification({
          type: 'success',
          title: 'WebSocket Connected',
          message: 'Real-time data updates are now active',
        });
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        
        try {
          const data: RealtimeUpdate = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          setLastMessage(data);
          
          // 触发消息回调
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          addNotification({
            type: 'error',
            title: 'WebSocket Data Error',
            message: 'Failed to parse incoming data',
          });
        }
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        
        console.log('WebSocket disconnected:', event);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        
        // 触发断开连接回调
        if (onDisconnect) {
          onDisconnect();
        }

        // 如果不是主动关闭，尝试重连
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          attemptReconnect();
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          addNotification({
            type: 'error',
            title: 'WebSocket Connection Failed',
            message: `Failed to reconnect after ${maxReconnectAttempts} attempts`,
          });
        }
      };

      ws.onerror = (event) => {
        if (!mountedRef.current) return;
        
        console.error('WebSocket error:', event);
        setIsConnecting(false);
        
        // 触发错误回调
        if (onError) {
          onError(event);
        }

        addNotification({
          type: 'error',
          title: 'WebSocket Error',
          message: 'Connection error occurred',
        });
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnecting(false);
      
      addNotification({
        type: 'error',
        title: 'WebSocket Connection Error',
        message: 'Failed to establish connection',
      });
    }
  }, [url, onConnect, onDisconnect, onMessage, onError, maxReconnectAttempts, addNotification]);

  // 尝试重连
  const attemptReconnect = useCallback(() => {
    if (!mountedRef.current || reconnectAttemptsRef.current >= maxReconnectAttempts) {
      return;
    }

    reconnectAttemptsRef.current += 1;
    setConnectionAttempts(reconnectAttemptsRef.current);

    console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);

    addNotification({
      type: 'info',
      title: 'Reconnecting...',
      message: `Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
    });

    reconnectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, reconnectInterval);
  }, [connect, reconnectInterval, maxReconnectAttempts, addNotification]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    reconnectAttemptsRef.current = 0;
    setConnectionAttempts(0);
  }, []);

  // 发送消息
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        console.log('WebSocket message sent:', message);
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        addNotification({
          type: 'error',
          title: 'Message Send Error',
          message: 'Failed to send message',
        });
      }
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message);
      addNotification({
        type: 'warning',
        title: 'WebSocket Not Connected',
        message: 'Cannot send message - not connected',
      });
    }
  }, [addNotification]);

  // 自动连接
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // 清理函数
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // 监听页面可见性变化
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected && autoConnect) {
        // 页面变为可见且未连接时尝试重连
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, autoConnect, connect]);

  // 监听网络状态变化
  useEffect(() => {
    const handleOnline = () => {
      if (!isConnected && autoConnect) {
        connect();
      }
    };

    const handleOffline = () => {
      addNotification({
        type: 'warning',
        title: 'Network Offline',
        message: 'Network connection lost. Reconnecting when back online.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, autoConnect, connect, addNotification]);

  return {
    isConnected,
    isConnecting,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
    connectionAttempts,
  };
};

export default useWebSocket;