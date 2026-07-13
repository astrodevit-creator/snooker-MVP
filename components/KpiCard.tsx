
import React, { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';

interface KpiCardProps {
  title: string;
  value: string;
  icon: ReactNode;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon }) => {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 border-zinc-200 dark:border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-5 pb-1 sm:pb-2">
        <CardTitle className="text-[9px] sm:text-xs font-black uppercase tracking-wider text-muted-foreground truncate max-w-[100px] sm:max-w-none" title={title}>
          {title}
        </CardTitle>
        <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground opacity-70 shrink-0">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
        <div className="text-[13px] min-[375px]:text-sm sm:text-lg md:text-xl lg:text-2xl font-black tracking-tight truncate" title={value}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
};

export default KpiCard;
