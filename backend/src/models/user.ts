import { Schema, model } from 'mongoose';

interface IUser {
  email: string;
  password: string;
  role: 'admin' | 'employee';
  employeeId?: string;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'employee'], required: true },
  employeeId: { type: String },
});

export const User = model<IUser>('User', userSchema);