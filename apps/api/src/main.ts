import express from 'express';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3333;

const app = express();

app.get('/', (_req, res) => {
  res.send('hello');
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
