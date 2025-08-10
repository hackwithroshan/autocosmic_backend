
import express, { Request, Response, ErrorRequestHandler } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import apiRouter from './routes';
import { errorHandler } from './middlewares/error.handler';
import config from './config';

dotenv.config();

const app = express();
const port = config.port;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Root endpoint
const rootHandler = (req: Request, res: Response) => {
  res.json({ message: 'ZAINA COLLECTION Backend is running!' });
};
app.get('/', rootHandler);


// Global Error Handler
app.use(errorHandler as ErrorRequestHandler);


app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});