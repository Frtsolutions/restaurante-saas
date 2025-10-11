import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import http from 'http'; // ✨ NOVO: Importamos o módulo http nativo do Node.
import { Server } from 'socket.io'; // ✨ NOVO: Importamos o Server do socket.io.

const app = express();
app.use(cors());
app.use(express.json());

// ✨ NOVO: Criamos um servidor http que "envolve" nosso app Express.
const server = http.createServer(app);
// ✨ NOVO: Iniciamos o Socket.IO, atrelando-o ao nosso servidor http.
const io = new Server(server, {
  cors: {
    origin: "*", // Em produção, restrinja para o seu domínio do frontend
    methods: ["GET", "POST"]
  }
});

const prisma = new PrismaClient();
const port = 3333;

// --- Rotas de Produtos (sem alteração) ---
app.get('/products', async (request, response) => {
  const products = await prisma.product.findMany();
  return response.status(200).json(products);
});

// --- Rota de Pedidos (COM UMA GRANDE ATUALIZAÇÃO) ---
type OrderItemInput = {
  productId: string;
  quantity: number;
}

app.post('/orders', async (request, response) => {
  const items: OrderItemInput[] = request.body.items;

  const productIds = items.map(item => item.productId);
  const productsInDb = await prisma.product.findMany({
    where: { id: { in: productIds } }
  });

  let total = 0;
  for (const item of items) {
    const product = productsInDb.find(p => p.id === item.productId);
    if (product) {
      total += Number(product.price) * item.quantity;
    }
  }

  const createdOrder = await prisma.order.create({
    data: {
      total: total,
      items: {
        create: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        }))
      }
    },
    include: {
      items: {
        include: {
          product: true // Incluímos os dados completos do produto
        }
      }
    }
  });

  // ✨ A MÁGICA ACONTECE AQUI! ✨
  // Após salvar o pedido, emitimos um evento chamado 'new_order'.
  // Todos os clientes (como o KDS) que estiverem ouvindo receberão
  // os dados do pedido recém-criado em tempo real.
  io.emit('new_order', createdOrder);

  return response.status(201).json(createdOrder);
});

// ✨ NOVO: Em vez de app.listen, agora usamos server.listen.
server.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});