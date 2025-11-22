import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';

// Importando as rotas que criamos
import authRoutes from './routes/authRoutes';
import ingredientRoutes from './routes/ingredientRoutes';
import productRoutes from './routes/productRoutes';
import tableRoutes from './routes/tableRoutes';
import orderRoutes from './routes/orderRoutes';
import financialRoutes from './routes/financialRoutes';
import dashboardRoutes from './routes/dashboardRoutes';

const app = express();

// Configuração do CORS (Segurança)
const allowedOrigins = [
  'http://localhost:5173', // Local
  'https://meu-pdv-sistema.vercel.app' // SEU LINK DA VERCEL (Substitua se mudou)
];

app.use(cors({
  origin: function (origin, callback) {
    // Permite requisições sem origem (como apps mobile ou curl) ou se a origem estiver na lista
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true
}));

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH"],
    credentials: true
  }
});

// Middleware para injetar o 'io' nas requisições
// Assim as rotas podem usar req.io.emit()
app.use((req: any, res, next) => {
  req.io = io;
  next();
});

// --- CONECTANDO AS ROTAS ---
app.use('/auth', authRoutes);
app.use('/ingredients', ingredientRoutes);
app.use('/products', productRoutes);
app.use('/tables', tableRoutes);
app.use('/orders', orderRoutes);
// Atenção aqui: montamos em /financial/transactions para bater com o frontend
app.use('/financial/transactions', financialRoutes); 
app.use('/dashboard', dashboardRoutes);

// Rota de saúde (para o Render saber que está vivo)
app.get('/health', (req, res) => {
  res.send('API is running correctly 🚀');
});

const port = process.env.PORT || 3333;

server.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});