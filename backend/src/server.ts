import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { Decimal } from '@prisma/client/runtime/library';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const prisma = new PrismaClient();
const port = 3333;

const JWT_SECRET_KEY = "SEU_PROJETO_ESTA_FICANDO_INCRIVEL";

// ==================================================================
// INTERFACE DO TOKEN E EXTENSÃO DO EXPRESS
// ==================================================================
interface TokenPayload {
  userId: string;
  role: Role;
  name: string;
  companyId: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    export interface Request {
      user: TokenPayload;
    }
  }
}

// ==================================================================
// MIDDLEWARES DE AUTENTICAÇÃO E AUTORIZAÇÃO
// ==================================================================
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Token não fornecido." });
  }
  const [, token] = authHeader.split(' ');
  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY);
    req.user = decoded as TokenPayload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido." });
  }
};

const checkRole = (roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user.role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: "Acesso negado: permissões insuficientes." });
    }
    return next();
  };
};

// ==================================================================
// ROTAS DE AUTENTICAÇÃO
// ==================================================================
app.post('/auth/register', async (request, response) => {
  const { email, name, password, companyName } = request.body; 

  if (!companyName) {
    return response.status(400).json({ message: "O nome da empresa é obrigatório." });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  try {
    const newCompany = await prisma.company.create({
      data: {
        name: companyName,
        users: {
          create: {
            email,
            name,
            passwordHash,
            role: 'DONO' 
          }
        }
      },
      include: {
        users: true 
      }
    });

    const user = newCompany.users[0];
    const { passwordHash: _, ...userWithoutPassword } = user;
    return response.status(201).json(userWithoutPassword);

  } catch (error) {
    console.error(error);
    return response.status(409).json({ message: "Erro ao criar empresa. O email ou nome da empresa pode já existir." });
  }
});

app.post('/auth/login', async (request, response) => {
  const { email, password } = request.body;
  
  const user = await prisma.user.findUnique({
    where: { email }
  });
  
  if (!user) {
    return response.status(404).json({ message: "Usuário não encontrado." });
  }
  
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return response.status(401).json({ message: "Senha inválida." });
  }
  
  const token = jwt.sign(
    { 
      userId: user.id, 
      role: user.role,
      name: user.name,
      companyId: user.companyId 
    },
    JWT_SECRET_KEY,
    { expiresIn: '1d' }
  );
  
  return response.status(200).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId }
  });
});

// ==================================================================
// ROTAS DE INGREDIENTES / INSUMOS
// ==================================================================
app.get('/ingredients', authMiddleware, checkRole(['DONO']), async (request, response) => {
  const companyId = request.user.companyId;
  const ingredients = await prisma.ingredient.findMany({ 
    where: { companyId: companyId },
    orderBy: { name: 'asc' } 
  });
  return response.json(ingredients);
});

app.post('/ingredients', authMiddleware, checkRole(['DONO']), async (request, response) => {
  const companyId = request.user.companyId;
  const { name, stockQuantity, unit } = request.body;
  try {
    const ingredient = await prisma.ingredient.create({
      data: { name, stockQuantity: new Decimal(stockQuantity), unit, companyId: companyId }
    });
    return response.status(201).json(ingredient);
  } catch (error) {
    return response.status(409).json({ message: "Ingredient name already exists." });
  }
});

// ==================================================================
// ROTAS DE PRODUTOS
// ==================================================================
app.get('/products', authMiddleware, async (request, response) => {
  const companyId = request.user.companyId;
  const products = await prisma.product.findMany({ 
    where: { companyId: companyId },
    orderBy: { name: 'asc' } 
  });
  return response.status(200).json(products);
});

app.post('/products', authMiddleware, checkRole(['DONO']), async (request, response) => {
  const companyId = request.user.companyId;
  const { name, price, recipeItems } = request.body;
  try {
    const product = await prisma.product.create({
      data: {
        name,
        price: new Decimal(price),
        companyId: companyId,
        recipeItems: recipeItems && recipeItems.length > 0 ? {
          create: recipeItems.map((item: any) => ({
            ingredientId: item.ingredientId,
            quantity: new Decimal(item.quantity)
          }))
        } : undefined
      }
    });
    return response.status(201).json(product);
  } catch (error) {
     return response.status(409).json({ message: "Product name already exists." });
  }
});

// ==================================================================
// ROTAS DE MESAS
// ==================================================================
app.get('/tables', authMiddleware, async (request, response) => {
  const companyId = request.user.companyId;
  const tables = await prisma.table.findMany({ 
    where: { companyId: companyId },
    orderBy: { name: 'asc' } 
  });
  return response.status(200).json(tables);
});

app.post('/tables', authMiddleware, checkRole(['DONO']), async (request, response) => {
  const companyId = request.user.companyId;
  const { name } = request.body;
  try {
    const table = await prisma.table.create({ 
      data: { name, companyId: companyId }
    });
    return response.status(201).json(table);
  } catch (error) {
    return response.status(409).json({ message: "Table name already exists." });
  }
});

// ==================================================================
// ROTA DE PEDIDOS
// ==================================================================
type OrderItemInput = { productId: string; quantity: number; }
app.post('/orders', authMiddleware, async (request: Request, response: Response) => {
  const { userId, companyId } = request.user;
  const { items, tableId } = request.body as { items: OrderItemInput[], tableId?: string };

  const productIds = items.map(item => item.productId);
  const productsInDb = await prisma.product.findMany({
    where: { id: { in: productIds }, companyId: companyId }, 
    include: { recipeItems: true }
  });
  
  if (productsInDb.length !== items.length) {
    return response.status(400).json({ message: "Um ou mais produtos são inválidos ou não pertencem a esta empresa." });
  }

  const stockUpdates: any[] = [];
  for (const item of items) {
    const product = productsInDb.find(p => p.id === item.productId);
    if (!product) continue;
    if (product.recipeItems.length > 0) {
      for (const recipeItem of product.recipeItems) {
        stockUpdates.push(prisma.ingredient.update({
          where: { id: recipeItem.ingredientId },
          data: { stockQuantity: { decrement: new Decimal(recipeItem.quantity).mul(item.quantity) } }
        }));
      }
    } else {
      const ingredientAsProduct = await prisma.ingredient.findFirst({ where: { name: product.name, companyId: companyId }});
      if(ingredientAsProduct) {
        stockUpdates.push(prisma.ingredient.update({
          where: { id: ingredientAsProduct.id },
          data: { stockQuantity: { decrement: item.quantity } }
        }));
      }
    }
  }
  
  const total = productsInDb.reduce((acc, product) => {
    const orderItem = items.find(item => item.productId === product.id);
    const itemQuantity = orderItem ? orderItem.quantity : 0;
    return acc + (Number(product.price) * itemQuantity);
  }, 0);
  
  try {
    const [createdOrder] = await prisma.$transaction([
      prisma.order.create({
        data: {
          total,
          tableId,
          userId: userId,
          companyId: companyId,
          items: { create: items.map(item => ({ productId: item.productId, quantity: item.quantity })) }
        },
        include: { items: { include: { product: true } } }
      }),
      ...stockUpdates
    ]);
    io.emit('new_order', createdOrder);
    return response.status(201).json(createdOrder);
  } catch (error) {
    console.error("Transaction failed: ", error);
    return response.status(500).json({ message: "Failed to process order and update stock." });
  }
});

// ==================================================================
// ROTAS DO FINANCEIRO
// ==================================================================
app.get('/financial/transactions', authMiddleware, checkRole(['DONO']), async (request, response) => {
  const companyId = request.user.companyId;
  const transactions = await prisma.financialTransaction.findMany({
    where: { companyId: companyId },
    orderBy: { createdAt: 'desc' }
  });
  return response.status(200).json(transactions);
});

app.post('/financial/transactions', authMiddleware, checkRole(['DONO']), async (request, response) => {
  const companyId = request.user.companyId;
  const { description, amount, type, dueDate } = request.body;
  try {
    const transaction = await prisma.financialTransaction.create({
      data: {
        description,
        amount: new Decimal(amount),
        type,
        dueDate: dueDate ? new Date(dueDate) : null,
        companyId: companyId
      }
    });
    return response.status(201).json(transaction);
  } catch (error) {
    console.error("Failed to create transaction: ", error);
    return response.status(500).json({ message: "Failed to create transaction." });
  }
});

// ==================================================================
// ROTA DE DASHBOARD (✨ COM CORREÇÕES DE 'undefined' ✨)
// ==================================================================
app.get('/dashboard/today', authMiddleware, checkRole(['DONO']), async (request, response) => {
    const companyId = request.user.companyId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const salesData = await prisma.order.aggregate({
        where: { createdAt: { gte: today }, companyId: companyId },
        _sum: { total: true },
        _count: { id: true } // Corrigido de '_all' para 'id'
    });

    const topProductsRaw = await prisma.orderItem.groupBy({
        by: ['productId'],
        where: { 
          order: { createdAt: { gte: today }, companyId: companyId }
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5
    });

    const topProductIds = topProductsRaw.map(p => p.productId);
    const productDetails = await prisma.product.findMany({ 
      where: { id: { in: topProductIds }, companyId: companyId }
    });

    const topProducts = topProductsRaw.map(p => {
        const product = productDetails.find(pd => pd.id === p.productId);
        return {
            productId: p.productId,
            name: product?.name || 'Produto não encontrado',
            quantitySold: p._sum?.quantity || 0 // ✨ CORREÇÃO AQUI
        }
    });

    const dashboardData = {
        totalRevenue: salesData._sum?.total || 0, // ✨ CORREÇÃO AQUI
        orderCount: salesData._count?.id || 0, // ✨ CORREÇÃO AQUI
        topProducts: topProducts
    };
    return response.status(200).json(dashboardData);
});

// ==================================================================
// INICIA O SERVIDOR
// ==================================================================
server.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});