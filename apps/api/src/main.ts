import express from 'express';
import cors from 'cors';
import bibleRouter from './routes/bible';
import booksRouter from './routes/books';
import wscRouter from './routes/wsc';
import worksRouter from './routes/works';
import workUnitsRouter from './routes/work-units';
import pdfRouter from './routes/pdf';
import transformsRouter from './routes/transforms';
import flagsRouter from './routes/flags';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3333;

const app = express();

// Enable CORS for frontend
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Routes
app.get('/', (_req, res) => {
  res.send('Theologos API');
});

app.use('/api/bible', bibleRouter);
app.use('/api/books', booksRouter);
app.use('/api/works', worksRouter);
app.use('/api/work-units', workUnitsRouter);
app.use('/api/pdf', pdfRouter);
app.use('/api/transforms', transformsRouter);
app.use('/api/flags', flagsRouter);
app.use('/api/wsc', wscRouter); // Legacy endpoint, kept for backward compatibility

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
