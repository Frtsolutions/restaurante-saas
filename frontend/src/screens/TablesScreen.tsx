import { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  Container,
  Title,
  SimpleGrid,
  Paper,
  Text,
  List,
  Button,
  Group,
  Badge
} from '@mantine/core';

// Configuração da URL
const API_URL = 'https://meu-pdv-backend.onrender.com';
const socket = io(API_URL);

// Interfaces locais
interface Product { id: string; name: string; price: string; imageUrl: string | null; }
interface FullOrder {
  id: string;
  total: number;
  createdAt: string;
  status: string;
  items: { id: string; quantity: number; product: Product; }[];
}
// Exportamos essa interface pois ela será usada no App.tsx para tipar a seleção
export interface TableData {
  id: string;
  name: string;
  currentTotal?: number;
  activeOrders?: FullOrder[];
}

interface TablesScreenProps {
  onSelectTable: (table: TableData) => void;
}

export function TablesScreen({ onSelectTable }: TablesScreenProps) {
  const [tables, setTables] = useState<TableData[]>([]);
  const [kdsOrders, setKdsOrders] = useState<FullOrder[]>([]);

  useEffect(() => {
    fetchTables();

    // Configura listeners do Socket para atualizar em tempo real
    socket.on('new_order', (newOrder: FullOrder) => {
      setKdsOrders(prev => [newOrder, ...prev]);
      fetchTables(); // Atualiza total das mesas
    });

    socket.on('order_updated', () => {
      fetchTables();
      // Em um app real, filtraríamos os pedidos do KDS aqui também
    });

    return () => {
      socket.off('new_order');
      socket.off('order_updated');
    };
  }, []);

  const fetchTables = async () => {
    try {
      const response = await axios.get(`${API_URL}/tables`);
      setTables(response.data);
    } catch (error) {
      console.error("Erro ao buscar mesas:", error);
    }
  };

  async function handleOrderReady(orderId: string) {
    try {
      await axios.patch(`${API_URL}/orders/${orderId}/ready`);
      // Remove visualmente do KDS
      setKdsOrders(prev => prev.filter(o => o.id !== orderId));
    } catch {
      alert('Erro ao atualizar pedido');
    }
  }

  return (
    <Container size="lg" mt="md">
      <Title order={1} mb="xl">Seleção de Mesas</Title>
      
      <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="lg" mb="xl">
        {tables.map(table => (
          <Paper
            key={table.id}
            shadow="sm"
            p="lg"
            radius="md"
            withBorder
            onClick={() => onSelectTable(table)}
            style={{
              cursor: 'pointer',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              minHeight: 100
            }}
            bg={(table.currentTotal || 0) > 0 ? 'red.1' : 'green.1'}
          >
            <Text fw={700} size="lg">{table.name}</Text>
            {(table.currentTotal || 0) > 0 && (
              <Badge color="red" variant="light" mt="xs" size="lg">
                R$ {Number(table.currentTotal).toFixed(2)}
              </Badge>
            )}
          </Paper>
        ))}
      </SimpleGrid>

      <hr style={{ margin: '30px 0', border: 'none', borderTop: '2px solid lightblue' }} />

      <div>
        <Title order={1} mb="xl">KDS - Cozinha</Title>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {kdsOrders.filter(o => o.status === 'PENDING').length === 0 && (
            <Text c="dimmed">Nenhum pedido pendente.</Text>
          )}
          
          {kdsOrders.filter(o => o.status === 'PENDING').map(order => (
            <Paper key={order.id} shadow="md" p="md" radius="md" withBorder bg="yellow.1">
              <Group justify="space-between" mb="xs">
                <Title order={4}>#{order.id.substring(0, 4)}</Title>
                <Button size="xs" color="dark" onClick={() => handleOrderReady(order.id)}>
                  Pronto
                </Button>
              </Group>
              <List size="sm">
                {order.items.map(item => (
                  <List.Item key={item.id}>
                    <Text component="span" fw={700}>{item.quantity}x</Text> {item.product.name}
                  </List.Item>
                ))}
              </List>
            </Paper>
          ))}
        </SimpleGrid>
      </div>
    </Container>
  );
}