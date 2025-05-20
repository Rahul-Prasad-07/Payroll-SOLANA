import mongoose from 'mongoose';

export const connectToMongo = async (): Promise<void> => {
    const uri = process.env.MONGO_URI || 'mongodb://admin:securepassword@localhost:27017/payroll?authSource=admin';
    console.log('Connecting to MongoDB with URI:', uri); // Debug log
    await mongoose.connect(uri, { dbName: 'payroll' });
    console.log('Connected to MongoDB');
};