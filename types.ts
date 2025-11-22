export interface User {
  email: string;
  name: string;
  password?: string; // In a real app, this would be hashed or handled by an auth provider
  budget?: number; // Monthly budget limit in DH
}

export interface Expense {
  id: string;
  userId: string;
  amount: number;
  category: string;
  description: string;
  date: string; // ISO string
  createdAt: number;
}

export interface Appointment {
  id: string;
  userId: string;
  title: string;
  date: string; // ISO string for Date AND Time
  status: 'scheduled' | 'completed' | 'cancelled';
  type: 'meeting' | 'call' | 'reminder' | 'other';
  createdAt: number;
  notified?: boolean; // To prevent double alerts
}

export enum ViewState {
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  APPOINTMENTS = 'APPOINTMENTS',
  LIVE_SESSION = 'LIVE_SESSION'
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}