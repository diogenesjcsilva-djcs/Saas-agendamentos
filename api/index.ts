import express from 'express';
import apiRouter from '../src/lib/api-routes';

const app = express();
app.use(express.json());

// Mount the API Router under /api
app.use('/api', apiRouter);

// Export the app as the default handler for Vercel Serverless Functions
export default app;
