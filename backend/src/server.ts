import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const prisma = new PrismaClient();
const port = 3333;

// --- Rotas existentes (sem alteração) ---
app.get('/products', async (request, response) => {
  const products = await prisma.product.findMany();
  return response.status(200).json(products);
});

app.post('/orders', async (request, response) => {
  const items: { productId: string; quantity: number }[] = request.body.items;
  const productIds = items.map(item => item.productId);
  const productsInDb = await prisma.product.findMany({ where: { id: { in: productIds } } });
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
      items: { create: items.map(item => ({ productId: item.productId, quantity: item.quantity })) }
    },
    include: { items: { include: { product: true } } }
  });
  io.emit('new_order', createdOrder);
  return response.status(201).json(createdOrder);
});

// ==================================================================
// ✨ NOSSA NOVA ROTA PARA O DASHBOARD
// ==================================================================
app.get('/dashboard/today', async (request, response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Define a data para o início do dia (meia-noite)

  // 1. Calcula o total faturado e o número de pedidos de hoje
  const salesData = await prisma.order.aggregate({
    where: {
      createdAt: {
        gte: today // 'gte' significa 'greater than or equal to' (maior ou igual a)
      }
    },
    _sum: {
      total: true // Soma a coluna 'total'
    },
    _count: {
      id: true // Conta a coluna 'id' para saber o número de pedidos
    }
  });

  // 2. Encontra os produtos mais vendidos de hoje
  const topProductsRaw = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        createdAt: {
          gte: today
        }
      }
    },
    _sum: {
      quantity: true // Soma a quantidade de cada produto
    },
    orderBy: {
      _sum: {
        quantity: 'desc' // Ordena pela soma da quantidade, em ordem decrescente
      }
    },
    take: 5 // Pega os 5 primeiros (o top 5)
  });

  // 3. Busca os nomes dos produtos mais vendidos
  const topProductIds = topProductsRaw.map(p => p.productId);
  const productDetails = await prisma.product.findMany({
    where: { id: { in: topProductIds } }
  });

  // 4. Junta as informações para um resultado mais amigável
  const topProducts = topProductsRaw.map(p => {
    const product = productDetails.find(pd => pd.id === p.productId);
    return {
      productId: p.productId,
      name: product?.name || 'Produto não encontrado',
      quantitySold: p._sum.quantity
    }
  });

  // 5. Monta o objeto final da resposta
  const dashboardData = {
    totalRevenue: salesData._sum.total || 0,
    orderCount: salesData._count.id || 0,
    topProducts: topProducts
  };

  return response.status(200).json(dashboardData);
});

// --- Inicia o servidor ---
server.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});