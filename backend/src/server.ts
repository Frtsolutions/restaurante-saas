import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();
const port = 3333;

// --- Rotas de Produtos (sem alteração) ---
app.get('/products', async (request, response) => {
  const products = await prisma.product.findMany();
  return response.status(200).json(products);
});

app.post('/products', async (request, response) => {
  const { name, price } = request.body;
  const product = await prisma.product.create({
    data: { name, price }
  });
  return response.status(201).json(product);
});


// ==================================================================
// ✨ NOSSA NOVA ROTA PARA CRIAR PEDIDOS (ORDERS)
// ==================================================================
type OrderItemInput = {
  productId: string;
  quantity: number;
}

app.post('/orders', async (request, response) => {
  const items: OrderItemInput[] = request.body.items;

  // 1. Busca os preços de todos os produtos do pedido no banco de dados.
  const productIds = items.map(item => item.productId);
  const productsInDb = await prisma.product.findMany({
    where: {
      id: { in: productIds }
    }
  });

  // 2. Calcula o total no backend para garantir segurança.
  let total = 0;
  for (const item of items) {
    const product = productsInDb.find(p => p.id === item.productId);
    if (product) {
      total += Number(product.price) * item.quantity;
    }
  }

  // 3. Salva o pedido e os itens do pedido em uma única transação.
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
    include: { // Inclui os itens recém-criados na resposta
      items: true
    }
  });

  return response.status(201).json(createdOrder);
});


// --- Inicia o servidor ---
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});