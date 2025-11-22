import { useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import {
  Container,
  Title,
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Anchor,
  Stack,
  Text
} from '@mantine/core';

// URL da API (ajuste se necessário)
const API_URL = 'https://meu-pdv-backend.onrender.com';

// Definimos o que esse componente "devolve" para o App principal quando o login dá certo
interface LoginScreenProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Estados do formulário
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        // Fluxo de Registro
        await axios.post(`${API_URL}/auth/register`, {
          email,
          name,
          password,
          companyName
        });
        // Se registrar com sucesso, faz o login automaticamente na sequência
      }

      // Fluxo de Login (ou login após registro)
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password
      });

      const { token, user } = response.data;
      
      // Chama a função do pai (App.tsx) para avisar que logou
      onLoginSuccess(token, user);

    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.message || 
        'Erro ao conectar com o servidor. Verifique sua internet.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center">
        {isRegistering ? 'Crie sua Conta' : 'Login - Meu PDV'}
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md" component="form" onSubmit={handleSubmit}>
        <Stack>
          {isRegistering && (
            <>
              <TextInput 
                label="Nome da Empresa" 
                placeholder="Ex: Pizzaria do Zé" 
                value={companyName} 
                onChange={(e) => setCompanyName(e.target.value)} 
                required 
              />
              <TextInput 
                label="Seu Nome" 
                placeholder="Ex: José Silva" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </>
          )}

          <TextInput 
            label="Email" 
            placeholder="seu@email.com" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
          
          <PasswordInput 
            label="Senha" 
            placeholder="Sua senha" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />

          {error && <Text c="red" size="sm" ta="center">{error}</Text>}

          <Button type="submit" fullWidth loading={loading}>
            {isRegistering ? 'Registrar Empresa' : 'Entrar'}
          </Button>
        </Stack>

        <Anchor 
          component="button" 
          type="button" 
          c="dimmed" 
          size="sm" 
          ta="center" 
          mt="md" 
          // fullWidth foi removido daqui
          onClick={() => {
            setIsRegistering(!isRegistering);
            setError('');
          }}
          style={{ display: 'block', width: '100%' }} // Usamos estilo CSS para ocupar a largura
        >
          {isRegistering 
            ? 'Já tem uma conta? Faça login' 
            : 'Não tem uma conta? Crie agora'}
        </Anchor>
      </Paper>
    </Container>
  );
}