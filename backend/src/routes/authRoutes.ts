import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma'; // Importando nossa configuração centralizada

const router = Router();
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "SEU_PROJETO_ESTA_FICANDO_INCRIVEL";

// Rota de Registro
router.post('/register', async (req: Request, res: Response) => {
  const { email, name, password, companyName } = req.body;

  if (!companyName) {
    return res.status(400).json({ message: "O nome da empresa é obrigatório." });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  try {
    // Cria empresa e usuário em uma transação
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
      include: { users: true }
    });

    const user = newCompany.users[0];
    // @ts-ignore
    const { passwordHash: _, ...userWithoutPassword } = user;

    return res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    return res.status(409).json({ message: "Erro ao criar conta. Email já existe?" });
  }
});

// Rota de Login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    return res.status(401).json({ message: "Senha inválida." });
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

  return res.status(200).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId
    }
  });
});

export default router;