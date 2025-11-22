import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Container, 
  Title, 
  SimpleGrid, 
  Paper, 
  Text, 
  Table 
} from '@mantine/core';

// Configuração da URL (mesma do App.tsx)
const API_URL = 'https://meu-pdv-backend.onrender.com';

// Interfaces locais para esta tela
interface DashboardData { 
  totalRevenue: number; 
  orderCount: number; 
  topProducts: { 
    productId: string; 
    name: string; 
    quantitySold: number; 
  }[]; 
}

export function DashboardScreen() {
  const [data, setData] = useState<DashboardData>({ 
    totalRevenue: 0, 
    orderCount: 0, 
    topProducts: [] 
  });

  // Busca os dados assim que a tela carrega
  useEffect(() => {
    axios.get(`${API_URL}/dashboard/today`)
      .then(response => setData(response.data))
      .catch(error => console.error("Erro ao carregar dashboard:", error));
  }, []);

  return (
    <Container size="lg" mt="md">
      <Title order={1} mb="xl">Dashboard - Vendas de Hoje</Title>
      
      {/* Cards de Indicadores */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} mb="xl">
        <Paper shadow="xs" p="xl" withBorder radius="md">
          <Title order={3} c="dimmed">Faturamento Total</Title>
          <Text fz="xxl" fw={700} c="green">
            R$ {parseFloat(String(data.totalRevenue || 0)).toFixed(2)}
          </Text>
        </Paper>
        
        <Paper shadow="xs" p="xl" withBorder radius="md">
          <Title order={3} c="dimmed">Total de Pedidos</Title>
          <Text fz="xxl" fw={700}>
            {data.orderCount}
          </Text>
        </Paper>
      </SimpleGrid>
      
      {/* Tabela de Top Produtos */}
      <Title order={2} mb="md">Top 5 Produtos Mais Vendidos</Title>
      <Table.ScrollContainer minWidth={500}>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Unidades Vendidas</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.topProducts.map((p) => (
              <Table.Tr key={p.productId}>
                <Table.Td>{p.name}</Table.Td>
                <Table.Td>{p.quantitySold}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Container>
  );
}