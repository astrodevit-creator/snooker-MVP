
import React, { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';

interface AnalyticsCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

const AnalyticsCard: React.FC<AnalyticsCardProps> = ({ title, icon, children }) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
};

export default AnalyticsCard;
