import express from 'express';
import cors from 'cors';
import bibleRouter from './routes/bible';
import booksRouter from './routes/books';

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

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
