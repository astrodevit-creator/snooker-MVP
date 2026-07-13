
import { useCallback, useState, useEffect } from 'react';

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn("Ce navigateur ne supporte pas les notifications de bureau.");
      return false;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, []);

  const sendNotification = useCallback((title: string, body: string) => {
    if (Notification.permission === 'granted') {
      try {
        // Fix: Removed 'vibrate' and 'badge' as they are not part of the standard NotificationOptions 
        // for the browser Notification constructor in many TypeScript environments, causing compilation errors.
        const n = new Notification(title, {
          body,
          icon: '/vite.svg', // Fallback icon
        });
        
        // Mobile browsers often require the app to be in background or a service worker
        // but modern browsers will show this if the tab is open or recently active.
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch (e) {
        console.error("Erreur lors de l'envoi de la notification:", e);
      }
    }
  }, []);

  return { permission, requestPermission, sendNotification };
};
