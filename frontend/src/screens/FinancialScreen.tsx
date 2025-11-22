import { useState, useEffect } from 'react';
import type { FormEvent } from 'react'; // ✨ CORREÇÃO: 'type' adicionado aqui
import axios from 'axios';
import {
  Container,
  Title,
  Paper,
  Stack,
  TextInput,
  Group,
  NumberInput,
  Select,
  Button,
  Table
} from '@mantine/core';

// Configuração da URL
const API_URL = 'https://meu-pdv-backend.onrender.com';

interface FinancialTransaction {
  id: string;
  description: string;
  amount: string;
  type: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

export function FinancialScreen() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  
  // Estados do formulário
  const [newTransactionDesc, setNewTransactionDesc] = useState('');
  const [newTransactionAmount, setNewTransactionAmount] = useState('');
  const [newTransactionType, setNewTransactionType] = useState('DESPESA');
  const [newTransactionDueDate, setNewTransactionDueDate] = useState('');

  // Buscar dados ao carregar
  useEffect(() => {
    axios.get(`${API_URL}/financial/transactions`)
      .then(response => setTransactions(response.data))
      .catch(error => console.error("Erro ao buscar transações:", error));
  }, []);

  async function handleCreateTransaction(event: FormEvent) {
    event.preventDefault();
    if (!newTransactionDesc || !newTransactionAmount) {
      alert('Preencha a descrição e o valor.');
      return;
    }

    const payload = {
      description: newTransactionDesc,
      amount: parseFloat(newTransactionAmount),
      type: newTransactionType,
      dueDate: newTransactionDueDate || null
    };

    try {
      const response = await axios.post(`${API_URL}/financial/transactions`, payload);
      // Adiciona a nova transação no início da lista
      setTransactions([response.data, ...transactions]);
      
      // Limpa o formulário
      setNewTransactionDesc('');
      setNewTransactionAmount('');
      setNewTransactionType('DESPESA');
      setNewTransactionDueDate('');
      alert('Transação registrada com sucesso!');
    } catch (error) {
      console.error('Erro ao registrar transação:', error);
      alert('Erro ao registrar transação.');
    }
  }

  return (
    <Container size="lg" mt="md">
      <Title order={1} mb="xl">Financeiro - Contas a Pagar/Receber</Title>

      {/* Formulário de Nova Transação */}
      <Paper shadow="xs" p="md" mb="xl" withBorder component="form" onSubmit={handleCreateTransaction}>
        <Title order={3} mb="md">Registrar Nova Transação</Title>
        <Stack>
          <TextInput
            label="Descrição"
            placeholder="Ex: Aluguel, Compra de Mercadoria"
            value={newTransactionDesc}
            onChange={(event) => setNewTransactionDesc(event.currentTarget.value)}
            required
          />
          <Group grow>
            <NumberInput
              label="Valor (R$)"
              placeholder="Ex: 150.50"
              value={newTransactionAmount}
              onChange={(value) => setNewTransactionAmount(String(value))}
              min={0}
              step={0.01}
              decimalScale={2}
              required
              prefix="R$ "
            />
            <Select
              label="Tipo"
              value={newTransactionType}
              onChange={(value) => setNewTransactionType(value || 'DESPESA')}
              data={[
                { value: 'DESPESA', label: 'Despesa' },
                { value: 'RECEITA', label: 'Receita' },
              ]}
              required
              allowDeselect={false}
            />
            <TextInput
              type='date'
              label="Data de Vencimento (Opcional)"
              value={newTransactionDueDate}
              onChange={(event) => setNewTransactionDueDate(event.currentTarget.value)}
            />
          </Group>
          <Button type="submit" mt="md">Adicionar Transação</Button>
        </Stack>
      </Paper>

      {/* Tabela de Histórico */}
      <Title order={2} mb="md">Histórico de Transações</Title>
      <Table.ScrollContainer minWidth={600}>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Valor (R$)</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Vencimento</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {transactions.map(t => (
              <Table.Tr key={t.id}>
                <Table.Td>{t.description}</Table.Td>
                <Table.Td style={{ color: t.type === 'DESPESA' ? 'red' : 'green' }}>
                  {parseFloat(t.amount).toFixed(2)}
                </Table.Td>
                <Table.Td>{t.type}</Table.Td>
                <Table.Td>
                  {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-'}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Container>
  );
}