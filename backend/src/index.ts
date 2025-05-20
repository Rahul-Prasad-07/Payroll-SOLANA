import cors from 'cors';
import dotenv from 'dotenv';
import express, { Express } from 'express';

import payrollRoutes from './routes/payrollRoutes'
import { connectToMongo } from './utils/mongo'
import { configureLogger } from './utils/logger'
import authRoutes from './routes/authRoutes'
// import { schedulePayments } from './utils/scheduler';

dotenv.config();

const app: Express = express();
configureLogger();

app.use(cors());
app.use(express.json());

// Connect to MongoDB
interface MongoConnectionError extends Error { }

connectToMongo().catch((err: MongoConnectionError): never => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
});

app.use('/api/payroll', payrollRoutes);
app.use('/api/auth', authRoutes);

// Schedule automated payments
// schedulePayments();

const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});