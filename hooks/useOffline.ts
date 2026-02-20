import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export const useOffline = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected;
      setIsOffline(offline);
      setIsConnected(state.isConnected ?? false);
      
      console.log('📶 Conexión:', offline ? 'OFFLINE' : 'ONLINE');
    });

    return () => unsubscribe();
  }, []);

  return { isOffline, isConnected };
};