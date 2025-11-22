import { FunctionDeclaration, Type } from '@google/genai';
import { storageService } from './storage';
import { User } from '../types';

export const expenseTools: FunctionDeclaration[] = [
  // --- Expense Tools ---
  {
    name: 'addExpense',
    description: 'Record a new expense. Use this for financial transactions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: 'The cost.' },
        category: { type: Type.STRING, description: 'Category: Food, Transport, Shopping, etc.' },
        description: { type: Type.STRING, description: 'Short description.' },
        date: { type: Type.STRING, description: 'ISO Date YYYY-MM-DD.' },
      },
      required: ['amount', 'category', 'description', 'date'],
    },
  },
  {
    name: 'updateExpense',
    description: 'Update an existing expense.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        amount: { type: Type.NUMBER },
        category: { type: Type.STRING },
        description: { type: Type.STRING },
        date: { type: Type.STRING },
      },
      required: ['id'],
    },
  },
  {
    name: 'setBudget',
    description: 'Set the monthly budget limit.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER },
      },
      required: ['amount'],
    },
  },
  {
    name: 'getExpenses',
    description: 'Retrieve expense history.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'requestManualEntry',
    description: 'Use when user input is vague about an expense.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prefilledDescription: { type: Type.STRING },
      },
    },
  },

  // --- Appointment Tools (Mawa3id) ---
  {
    name: 'addAppointment',
    description: 'Schedule a new appointment, meeting, or reminder (Maw3id).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Title or purpose of the appointment (e.g., "Meeting with Said").' },
        date: { type: Type.STRING, description: 'Full ISO Date and Time (YYYY-MM-DDTHH:mm:ss). Calculate this based on user input and current time.' },
        type: { type: Type.STRING, description: 'One of: meeting, call, reminder, other' },
      },
      required: ['title', 'date', 'type'],
    },
  },
  {
    name: 'getAppointments',
    description: 'List upcoming or past appointments/mawa3id.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'updateAppointmentStatus',
    description: 'Mark an appointment as completed or cancelled.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        status: { type: Type.STRING, description: 'completed or cancelled' },
      },
      required: ['id', 'status'],
    },
  },
  {
    name: 'deleteAppointment',
    description: 'Remove an appointment.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
      },
      required: ['id'],
    },
  }
];

export const executeExpenseTool = async (name: string, args: any, user: User): Promise<any> => {
  console.log(`Executing tool: ${name}`, args);
  try {
    // --- Expense Logic ---
    if (name === 'addExpense') {
      const expense = await storageService.addExpense({
        userId: user.email,
        amount: args.amount,
        category: args.category,
        description: args.description,
        date: args.date
      });
      return { result: 'Expense added successfully', expense };
    } 
    else if (name === 'updateExpense') {
      const all = await storageService.getExpenses(user.email);
      const existing = all.find(e => e.id === args.id);
      if (!existing) return { error: 'Expense not found' };
      await storageService.updateExpense({ ...existing, ...args });
      return { result: 'Expense updated' };
    }
    else if (name === 'setBudget') {
      const updatedUser = { ...user, budget: args.amount };
      await storageService.updateUser(updatedUser);
      return { result: `Budget set to ${args.amount} DH`, user: updatedUser };
    }
    else if (name === 'getExpenses') {
      const expenses = await storageService.getExpenses(user.email);
      return { result: JSON.stringify(expenses.slice(0, 10)) };
    }
    else if (name === 'requestManualEntry') {
      return { result: 'Manual form requested' };
    }

    // --- Appointment Logic ---
    else if (name === 'addAppointment') {
      const appt = await storageService.addAppointment({
        userId: user.email,
        title: args.title,
        date: args.date,
        type: args.type || 'reminder'
      });
      return { result: `Appointment scheduled: ${args.title} at ${new Date(args.date).toLocaleString()}`, appointment: appt };
    }
    else if (name === 'getAppointments') {
      const appts = await storageService.getAppointments(user.email);
      // Filter for readability
      const summary = appts.map(a => ({
        id: a.id,
        title: a.title,
        time: new Date(a.date).toLocaleString(),
        status: a.status
      }));
      return { result: JSON.stringify(summary) };
    }
    else if (name === 'updateAppointmentStatus') {
      const all = await storageService.getAppointments(user.email);
      const existing = all.find(a => a.id === args.id);
      if (!existing) return { error: 'Appointment not found' };
      
      const updated = { ...existing, status: args.status };
      await storageService.updateAppointment(updated);
      return { result: `Appointment marked as ${args.status}` };
    }
    else if (name === 'deleteAppointment') {
      await storageService.deleteAppointment(args.id);
      return { result: 'Appointment deleted' };
    }

    return { error: 'Unknown tool' };
  } catch (err: any) {
    return { error: err.message };
  }
};