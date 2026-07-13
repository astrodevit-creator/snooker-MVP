
import React, { useEffect, useRef } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAIAuditor } from '../hooks/useAIAuditor';

const NotificationWatcher: React.FC = () => {
  const { alerts } = useAIAuditor();
  const { sendNotification, requestPermission } = useNotifications();
  const desktopNotified = useRef<Set<string>>(new Set());

  // Request permission on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    alerts.forEach(alert => {
      if (!desktopNotified.current.has(alert.id)) {
        const title = `🚨 Contrôleur IA : Seuil Dépassé`;
        const body = `La table "${alert.game.tableName}" (${alert.game.player1}) a dépassé ${alert.thresholdMinutes} minutes (${Math.floor(alert.elapsedMinutes)} min écoulées) !`;
        
        sendNotification(title, body);
        desktopNotified.current.add(alert.id);
      }
    });

    // Cleanup: if an alert is no longer active (game finished), remove from tracked
    const alertIds = new Set(alerts.map(a => a.id));
    desktopNotified.current.forEach(id => {
      if (!alertIds.has(id)) {
        desktopNotified.current.delete(id);
      }
    });
  }, [alerts, sendNotification]);

  return null; // Silent background component
};

export default NotificationWatcher;
