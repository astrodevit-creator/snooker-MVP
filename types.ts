
export enum Role {
  ADMIN = 'admin',
  USER = 'user',
}

export interface User {
  id: string;
  email: string;
  role: Role;
  allowedTables?: string | null;
}

export enum TableType {
  MINI = 'mini',
  ROYAL = 'royal',
}

export interface TableConfig {
  id: string;
  name: string;
  type: TableType;
  hourlyRate: number;
  ratePerGame: number;
  active: boolean;
  sortOrder: number;
}

export enum GameStatus {
  RUNNING = 'Running',
  FINISHED = 'Finished',
}

export enum PaymentStatus {
  PENDING = 'Pending',
  PAID = 'Paid',
  LOAN = 'Loan',
}

export interface Game {
  id: string;
  date: string; // YYYY-MM-DD
  dayNumber: number | null; // Session number for the day, resets to 1 each business day
  tableName: string;
  tableType: TableType | null; // Snapshot of the table's type at session start
  hourlyRate: number; // Informational snapshot of the table's per-hour rate (not used for billing)
  ratePerGame: number; // Snapshot of the table's per-game rate, used for billing
  startTime: string; // ISO string
  endTime: string | null; // ISO string
  player1: string;
  player2: string | null;
  winner: string | null; // Name of the winner, or null for draw/not applicable
  loserName: string | null; // Name of the player who lost / owes for the session
  status: GameStatus;
  durationSeconds: number | null;
  priceMAD: number | null;
  discountMAD: number;
  finalPriceMAD: number | null;
  paymentStatus: PaymentStatus;
  notes: string | null;
  createdBy: string; // user ID
  modifiedBy: string | null; // user ID
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface DailySummary {
  date: string;
  totalPaid: number;
  totalLoan: number;
  totalDiscount: number;
  gameCount: number;
  archivedAt?: string; // Made optional to avoid schema mismatch
}
