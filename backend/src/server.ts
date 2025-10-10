import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors'; // ✨ 1. IMPORTAMOS O CORS

const app = express();

app.use(cors()); // ✨ 2. USAMOS O CORS. Esta linha é a "permissão" que o navegador precisa.
app.use(express.json());

const prisma = new PrismaClient();
const port = 3333;

// Rota GET de teste
app.get('/', (request, response) => {
  return response.send('Olá, Mundo! O backend está funcionando.');
});

// Rota para CRIAR produtos (POST)
app.post('/products', async (request, response) => {
  const { name, price } = request.body;
  const product = await prisma.product.create({
    data: { name, price }
  });
  return response.status(201).json(product);
});

// Rota para LER produtos (GET)
app.get('/products', async (request, response) => {
  const products = await prisma.product.findMany();
  return response.status(200).json(products);
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});