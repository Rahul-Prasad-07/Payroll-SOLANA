import { Schema, model } from 'mongoose';

interface IPaymentHistory {
    payrollId: string;
    employeeId: string;
    amount: number;
    taxAmount: number;
    deductions: number;
    timestamp: Date;
}

const paymentHistorySchema = new Schema<IPaymentHistory>({
    payrollId: { type: String, required: true },
    employeeId: { type: String, required: true },
    amount: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    deductions: { type: Number, required: true },
    timestamp: { type: Date, required: true },
});

export const PaymentHistory = model<IPaymentHistory>('PaymentHistory', paymentHistorySchema);