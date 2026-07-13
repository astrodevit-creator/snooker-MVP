
export enum Role {
  ADMIN = 'admin',
  USER = 'user',
}

export interface User {
  id: string;
  email: string;
  password: string;
  role: Role;
  allowedTables?: string | null;
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
  tableName: string; 
  hourlyRate: number;
  startTime: string; // ISO string
  endTime: string | null; // ISO string
  player1: string;
  player2: string | null;
  winner: string | null; // Name of the winner, or null for draw/not applicable
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
