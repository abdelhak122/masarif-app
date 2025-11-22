import { Expense, User, Appointment } from '../types';

// Keys for local storage
const USERS_KEY = 'expense_app_users';
const EXPENSES_KEY = 'expense_app_expenses';
const APPOINTMENTS_KEY = 'expense_app_appointments';
const CURRENT_USER_KEY = 'expense_app_current_user';

// Simulating a database delay - reduced for better UX
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper for safe parsing
const safeParse = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.warn(`Error parsing ${key}, resetting to fallback`, e);
    localStorage.removeItem(key);
    return fallback;
  }
};

export const storageService = {
  // --- Auth Methods ---

  async register(user: User): Promise<User> {
    await delay(100);
    try {
      const users = safeParse<User[]>(USERS_KEY, []);

      if (users.find((u) => u.email === user.email)) {
        throw new Error('User already exists');
      }

      // Set default budget if not provided
      const newUser = { ...user, budget: user.budget || 5000 }; 

      users.push(newUser);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      this.setCurrentUser(newUser);
      return newUser;
    } catch (e) {
      console.error("Error registering user", e);
      throw e;
    }
  },

  async login(email: string): Promise<User> {
    await delay(100);
    try {
      const users = safeParse<User[]>(USERS_KEY, []);
      const user = users.find((u) => u.email === email);

      if (!user) {
        throw new Error('User not found');
      }

      this.setCurrentUser(user);
      return user;
    } catch (e) {
      console.error("Error logging in", e);
      throw e;
    }
  },

  async updateUser(user: User): Promise<User> {
    await delay(100);
    const users = safeParse<User[]>(USERS_KEY, []);
    const index = users.findIndex(u => u.email === user.email);
    if (index !== -1) {
      users[index] = user;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      this.setCurrentUser(user);
    }
    return user;
  },

  logout() {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser(): User | null {
    return safeParse<User | null>(CURRENT_USER_KEY, null);
  },

  setCurrentUser(user: User) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  },

  // --- Expense Methods ---

  async addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
    await delay(100);
    const newExpense: Expense = {
      ...expense,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };

    const allExpenses = this.getAllExpensesRaw();
    allExpenses.push(newExpense);
    this.saveExpenses(allExpenses);
    return newExpense;
  },

  async updateExpense(expense: Expense): Promise<void> {
    await delay(100);
    const all = this.getAllExpensesRaw();
    const index = all.findIndex(e => e.id === expense.id);
    if (index !== -1) {
      all[index] = expense;
      this.saveExpenses(all);
    }
  },

  async getExpenses(userId: string): Promise<Expense[]> {
    await delay(100);
    const all = this.getAllExpensesRaw();
    return all.filter((e) => e.userId === userId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async deleteExpense(id: string): Promise<void> {
    await delay(100);
    const all = this.getAllExpensesRaw();
    const filtered = all.filter((e) => e.id !== id);
    this.saveExpenses(filtered);
  },

  getAllExpensesRaw(): Expense[] {
    return safeParse<Expense[]>(EXPENSES_KEY, []);
  },

  saveExpenses(expenses: Expense[]) {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  },

  // --- Appointment Methods (Mawa3id) ---

  async addAppointment(appt: Omit<Appointment, 'id' | 'createdAt' | 'status'>): Promise<Appointment> {
    await delay(100);
    const newAppt: Appointment = {
      ...appt,
      id: crypto.randomUUID(),
      status: 'scheduled',
      createdAt: Date.now(),
      notified: false,
    };

    const all = this.getAllAppointmentsRaw();
    all.push(newAppt);
    this.saveAppointments(all);
    return newAppt;
  },

  async getAppointments(userId: string): Promise<Appointment[]> {
    await delay(100);
    const all = this.getAllAppointmentsRaw();
    return all.filter(a => a.userId === userId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  async updateAppointment(appt: Appointment): Promise<void> {
    await delay(50); // Faster for background updates
    const all = this.getAllAppointmentsRaw();
    const index = all.findIndex(a => a.id === appt.id);
    if (index !== -1) {
      all[index] = appt;
      this.saveAppointments(all);
    }
  },

  async deleteAppointment(id: string): Promise<void> {
    await delay(100);
    const all = this.getAllAppointmentsRaw();
    const filtered = all.filter(a => a.id !== id);
    this.saveAppointments(filtered);
  },

  getAllAppointmentsRaw(): Appointment[] {
    return safeParse<Appointment[]>(APPOINTMENTS_KEY, []);
  },

  saveAppointments(appts: Appointment[]) {
    localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appts));
  }
};