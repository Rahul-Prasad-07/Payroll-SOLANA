import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import attenomicsRoutes from './routes/attenomicsRoutes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/attenomics', attenomicsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});