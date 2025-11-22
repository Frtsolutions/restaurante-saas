import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Grid,
  Paper,
  Title,
  ScrollArea,
  Stack,
  Group,
  Image,
  Box,
  Text,
  List,
  Button,
  Modal,
  Select,
  Divider,
  Affix,
  Drawer
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';

// Configuração da URL
const API_URL = 'https://meu-pdv-backend.onrender.com';

// Interfaces locais
interface Product { id: string; name: string; price: string; imageUrl: string | null; }
interface OrderItem extends Product { quantity: number; }
// Define a estrutura da Mesa
export interface TableData { 
  id: string; 
  name: string; 
  currentTotal?: number; 
  activeOrders?: any[]; 
}

interface OrderScreenProps {
  table: TableData | null;
  onBack: () => void;
}

export function OrderScreen({ table, onBack }: OrderScreenProps) {
  // Estados
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]); // Itens do carrinho atual
  
  // Estado do Pagamento
  const [paymentModalOpen, { open: openPaymentModal, close: closePaymentModal }] = useDisclosure(false);
  const [paymentMethod, setPaymentMethod] = useState('CREDIT');

  // UI Responsiva
  const [cartDrawerOpen, { open: openCart, close: closeCart }] = useDisclosure(false);
  const isMobile = useMediaQuery('(max-width: 48em)');

  // Carregar produtos ao montar a tela
  useEffect(() => {
    axios.get(`${API_URL}/products`)
      .then(response => setProducts(response.data))
      .catch(error => console.error("Erro ao buscar produtos:", error));
  }, []);

  // --- Funções de Lógica ---

  function addProductToOrder(product: Product) {
    const existing = orderItems.find(item => item.id === product.id);
    if (existing) {
      setOrderItems(orderItems.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setOrderItems([...orderItems, { ...product, quantity: 1 }]);
    }
  }

  const calculateTotalNew = () => {
    return orderItems.reduce((total, item) => total + (parseFloat(item.price) * item.quantity), 0).toFixed(2);
  };

  const calculateTotalTable = () => {
    return ((table?.currentTotal || 0) + Number(calculateTotalNew())).toFixed(2);
  };

  async function handleFinalizeOrder() {
    if (!table) return;
    
    const payload = {
      tableId: table.id,
      items: orderItems.map(item => ({
        productId: item.id,
        quantity: item.quantity
      }))
    };

    try {
      await axios.post(`${API_URL}/orders`, payload);
      alert(`Pedido enviado para a cozinha!`);
      setOrderItems([]); // Limpa o carrinho
      if (isMobile) closeCart();
      onBack(); // Volta para a seleção de mesas para forçar atualização
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar pedido.');
    }
  }

  async function handlePayTab() {
    if (!table) return;

    try {
      await axios.post(`${API_URL}/tables/${table.id}/pay`, { paymentMethod });
      alert('Conta fechada com sucesso!');
      closePaymentModal();
      onBack(); // Volta para a seleção de mesas
    } catch (error) {
      console.error(error);
      alert('Erro ao fechar conta.');
    }
  }

  // --- Renderização do Conteúdo da Comanda (Reutilizável) ---
  const renderCartContent = () => (
    <Paper shadow="xs" p="md" withBorder>
      {/* Lista de itens já pedidos (vindas do banco de dados na prop 'table') */}
      {table?.activeOrders && table.activeOrders.length > 0 && (
        <>
          <Title order={4} mb="xs" c="dimmed">Já Pedidos</Title>
          <List spacing="xs" size="sm" mb="md">
            {table.activeOrders.map((order: any) => (
              order.items.map((item: any) => (
                <List.Item key={item.id}>
                  <Text c="dimmed">
                    {item.quantity}x {item.product.name} - R$ {(Number(item.product.price) * item.quantity).toFixed(2)}
                  </Text>
                </List.Item>
              ))
            ))}
          </List>
          <Divider my="sm" />
        </>
      )}

      <Title order={4} mb="xs" c="blue">Novo Pedido</Title>
      
      {orderItems.length === 0 ? (
        <Text c="dimmed" size="sm">Nenhum item novo adicionado.</Text>
      ) : (
        <ScrollArea h={isMobile ? "calc(100vh - 300px)" : 400}>
          <List spacing="sm" size="sm" mb="md">
            {orderItems.map(item => (
              <List.Item key={item.id}>
                <Group justify="space-between">
                  <Text>{item.name} (x{item.quantity})</Text>
                  <Text fw={500}>R$ {(parseFloat(item.price) * item.quantity).toFixed(2)}</Text>
                </Group>
              </List.Item>
            ))}
          </List>
        </ScrollArea>
      )}
      
      <Divider my="md" />
      
      <Group justify="space-between" mb="md">
        <Title order={3}>Total Mesa:</Title>
        <Title order={3}>R$ {calculateTotalTable()}</Title>
      </Group>
      
      <Button 
        onClick={handleFinalizeOrder} 
        disabled={orderItems.length === 0} 
        fullWidth 
        color="green" 
        size="lg"
      >
        Enviar p/ Cozinha
      </Button>
    </Paper>
  );

  if (!table) return <Container><Text>Nenhuma mesa selecionada.</Text></Container>;

  return (
    <Container size="lg" mt="md">
      <Group justify="space-between" mb="md">
        <Button onClick={onBack} variant="light" leftSection={'←'}>
          Voltar
        </Button>
        <Title order={3}>Mesa: {table.name}</Title>
        <Button 
          color="red" 
          onClick={openPaymentModal} 
          disabled={(table.currentTotal || 0) <= 0 && orderItems.length === 0}
        >
          Fechar Conta
        </Button>
      </Group>

      <Grid>
        {/* Coluna Esquerda: Cardápio */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Title order={2} mb="md">Cardápio</Title>
          <ScrollArea h={600}>
            <Stack gap="sm">
              {products.map(p => (
                <Paper 
                  key={p.id} 
                  shadow="xs" 
                  p="md" 
                  withBorder 
                  onClick={() => addProductToOrder(p)} 
                  style={{ cursor: 'pointer' }}
                >
                  <Group>
                    {p.imageUrl ? (
                      <Image src={p.imageUrl} w={40} h={40} fit="cover" radius="sm" />
                    ) : (
                      <Box w={40} h={40} bg="gray.2" style={{borderRadius: 4}} />
                    )}
                    <Box style={{ flex: 1 }}>
                      <Group justify="space-between">
                        <Text fw={500}>{p.name}</Text>
                        <Text>R$ {parseFloat(p.price).toFixed(2)}</Text>
                      </Group>
                    </Box>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </ScrollArea>
        </Grid.Col>

        {/* Coluna Direita: Carrinho (Desktop) */}
        {!isMobile && (
          <Grid.Col span={5}>
            {renderCartContent()}
          </Grid.Col>
        )}
      </Grid>

      {/* Mobile: Botão Flutuante e Drawer */}
      {isMobile && (
        <>
          <Affix position={{ bottom: 20, right: 20 }}>
            {/* ✨ CORREÇÃO: shadow="xl" REMOVIDO ✨ */}
            <Button onClick={openCart} size="lg" radius="xl">
              Ver Comanda ({orderItems.length})
            </Button>
          </Affix>
          <Drawer 
            opened={cartDrawerOpen} 
            onClose={closeCart} 
            title={`Comanda - ${table.name}`} 
            position="bottom" 
            size="90%"
          >
            {renderCartContent()}
          </Drawer>
        </>
      )}

      {/* Modal de Pagamento */}
      <Modal opened={paymentModalOpen} onClose={closePaymentModal} title="Fechar Conta">
        <Stack>
          <Title order={2} ta="center">
            Total Final: R$ {Number(table.currentTotal || 0).toFixed(2)}
          </Title>
          <Select 
            label="Forma de Pagamento" 
            data={['CREDIT', 'DEBIT', 'CASH', 'PIX']} 
            value={paymentMethod} 
            onChange={(v) => setPaymentMethod(v || 'CREDIT')} 
            allowDeselect={false} 
          />
          <Button color="red" fullWidth onClick={handlePayTab} size="lg" mt="md">
            Confirmar Pagamento
          </Button>
        </Stack>
      </Modal>
    </Container>
  );
}