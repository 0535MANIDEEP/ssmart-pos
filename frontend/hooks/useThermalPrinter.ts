'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  isWebSerialSupported,
  listSerialPorts,
  connectPrinter,
  disconnectPrinter,
  reconnectPrinter,
  isPrinterConnected,
  getCurrentDevice,
  type ThermalPrinterDevice,
} from '@/lib/thermal-printer';

export type PrinterStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useThermalPrinter() {
  const [status, setStatus] = useState<PrinterStatus>('disconnected');
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(isWebSerialSupported());

    // Check if already connected
    if (isPrinterConnected()) {
      setStatus('connected');
    }

    // Listen for serial port disconnects
    const handleDisconnect = () => {
      setStatus('disconnected');
    };

    navigator.serial?.addEventListener('disconnect', handleDisconnect);
    return () => {
      navigator.serial?.removeEventListener('disconnect', handleDisconnect);
    };
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setStatus('connecting');

    try {
      await connectPrinter();
      setStatus('connected');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await disconnectPrinter();
      setStatus('disconnected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  }, []);

  const reconnect = useCallback(async () => {
    setError(null);
    setStatus('connecting');

    try {
      const device = await reconnectPrinter();
      if (device) {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Reconnect failed');
    }
  }, []);

  return {
    status,
    supported,
    error,
    connect,
    disconnect,
    reconnect,
    isConnected: status === 'connected',
  };
}
