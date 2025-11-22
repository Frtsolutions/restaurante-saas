import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
// Importações do Mantine
import { 
  AppShell, Group, Button, Title, Container, Tabs, TextInput, NumberInput, 
  Select, Stack, Table, Paper, SimpleGrid, Text, List, Grid, ScrollArea, 
  PasswordInput, Anchor, FileInput, Image, Box, Drawer, Affix, Burger, 
  Modal, Badge, Divider 
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';

// ==================================================================
// INTERFACES
// ==================================================================
interface Product { id: string; name: string; price: string; imageUrl: string | null; }
interface OrderItem extends Product { quantity: number; }
interface FullOrder { 
  id: string; 
  total: number; 
  createdAt: string; 
  status: string; 
  items: { id: string; quantity: number; product: Product; }[]; 
}
interface DashboardData { totalRevenue: number; orderCount: number; topProducts: { productId: string; name: string; quantitySold: number; }[]; }

// RENOMEADO PARA EVITAR CONFLITO COM O COMPONENTE TABLE DO MANTINE
interface TableData { 
  id: string; 
  name: string; 
  currentTotal?: number; 
  activeOrders?: FullOrder[]; 
}

interface Ingredient { id: string; name: string; stockQuantity: string; unit: string; }
interface FinancialTransaction { id: string; description: string; amount: string; type: string; dueDate: string | null; paidAt: string | null; createdAt: string; }
interface RecipeItemForm { ingredientId: string; name: string; quantity: string; }
interface User { id: string; name: string; email: string; role: 'DONO' | 'CAIXA'; companyId: string; }

// CONFIG API
const API_URL = 'https://meu-pdv-backend.onrender.com'; 
const socket = io(API_URL);

function App() {
  // --- Estados ---
  const [appView, setAppView] = useState('LOGIN');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<User['role'] | null>(null);
  
  // Login/Registro
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerCompanyName, setRegisterCompanyName] = useState('');

  // Dados do App
  const [currentView, setCurrentView] = useState('TABLE_SELECTION');
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<TableData[]>([]); // Usando a nova interface
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null); // Usando a nova interface
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [kdsOrders, setKdsOrders] = useState<FullOrder[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({ totalRevenue: 0, orderCount: 0, topProducts: [] });
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);

  // Controles de UI/Formulários
  const [managementSubView, setManagementSubView] = useState<string | null>('insumos');
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientQuantity, setNewIngredientQuantity] = useState('');
  const [newIngredientUnit, setNewIngredientUnit] = useState('un');
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [recipeItems, setRecipeItems] = useState<RecipeItemForm[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [selectedIngredientQuantity, setSelectedIngredientQuantity] = useState('');
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [newTransactionDesc, setNewTransactionDesc] = useState('');
  const [newTransactionAmount, setNewTransactionAmount] = useState('');
  const [newTransactionType, setNewTransactionType] = useState('DESPESA');
  const [newTransactionDueDate, setNewTransactionDueDate] = useState('');

  // --- Hooks UI Responsiva ---
  const [cartDrawerOpen, { open: openCart, close: closeCart }] = useDisclosure(false);
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [paymentModalOpen, { open: openPaymentModal, close: closePaymentModal }] = useDisclosure(false);
  const [paymentMethod, setPaymentMethod] = useState('CREDIT');

  // --- Efeitos ---
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userDataString = localStorage.getItem('userData');
    if (token && userDataString) {
      const userData: User = JSON.parse(userDataString);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUserRole(userData.role);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      axios.get(`${API_URL}/products`).then(r => setProducts(r.data)).catch(() => {});
      
      socket.on('new_order', (newOrder) => {
        setKdsOrders(prev => [newOrder, ...prev]);
        refreshTables(); 
      });
      socket.on('order_updated', () => refreshTables());
    }
    return () => { socket.off('new_order'); socket.off('order_updated'); };
  }, [isAuthenticated]);

  const refreshTables = () => {
    axios.get(`${API_URL}/tables`).then(r => {
      setTables(r.data);
      if (selectedTable) {
        const updated = r.data.find((t: TableData) => t.id === selectedTable.id);
        if (updated) setSelectedTable(updated);
      }
    }).catch(console.error);
  };

  useEffect(() => {
    if (isAuthenticated && currentView) {
      if (mobileOpened) toggleMobile();
      const fetchData = async () => {
        try {
          if (currentView === 'DASHBOARD') setDashboardData((await axios.get(`${API_URL}/dashboard/today`)).data);
          if (currentView === 'MANAGEMENT') {
            setIngredients((await axios.get(`${API_URL}/ingredients`)).data);
            setProducts((await axios.get(`${API_URL}/products`)).data);
            setTables((await axios.get(`${API_URL}/tables`)).data);
          }
          if (currentView === 'TABLE_SELECTION' || currentView === 'ORDER') {
             setTables((await axios.get(`${API_URL}/tables`)).data);
          }
          if (currentView === 'FINANCIAL') setTransactions((await axios.get(`${API_URL}/financial/transactions`)).data);
        } catch (e) { console.error(e); }
      };
      fetchData();
    }
  }, [currentView, isAuthenticated]);

  // --- Funções Auxiliares ---
  const handleLogout = () => {
    localStorage.clear();
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUserRole(null);
  };

  // --- Lógica de Negócio ---
  async function handleOrderReady(orderId: string) {
    try { await axios.patch(`${API_URL}/orders/${orderId}/ready`); setKdsOrders(prev => prev.filter(o => o.id !== orderId)); } catch { alert('Erro'); }
  }

  async function handlePayTab() {
    if (!selectedTable) return;
    try {
      await axios.post(`${API_URL}/tables/${selectedTable.id}/pay`, { paymentMethod });
      alert('Conta fechada com sucesso!');
      closePaymentModal();
      handleGoBackToTables();
      refreshTables();
    } catch { alert('Erro ao fechar conta.'); }
  }

  function handleSelectTable(table: TableData) { setSelectedTable(table); setCurrentView('ORDER'); }
  function handleGoBackToTables() { setSelectedTable(null); setOrderItems([]); setCurrentView('TABLE_SELECTION'); }
  
  function addProductToOrder(product: Product) {
    const existing = orderItems.find(item => item.id === product.id);
    if (existing) { setOrderItems(orderItems.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)); }
    else { setOrderItems([...orderItems, { ...product, quantity: 1 }]); }
  }
  const calculateTotalNew = () => orderItems.reduce((total, item) => total + (parseFloat(item.price) * item.quantity), 0).toFixed(2);
  const calculateTotalTable = () => ((selectedTable?.currentTotal || 0) + Number(calculateTotalNew())).toFixed(2);
  
  async function handleFinalizeOrder() {
    const payload = { tableId: selectedTable?.id, items: orderItems.map(item => ({ productId: item.id, quantity: item.quantity })) };
    try { 
      await axios.post(`${API_URL}/orders`, payload); 
      alert(`Pedido enviado para a cozinha!`);
      setOrderItems([]);
      if (isMobile) closeCart();
      refreshTables();
    } catch { alert('Erro ao enviar.'); }
  }

  // --- CRIAÇÃO DE DADOS (Gestão) ---
  async function handleLogin(e: FormEvent) { e.preventDefault(); setAuthError(''); try { const r = await axios.post(`${API_URL}/auth/login`, { email: loginEmail, password: loginPassword }); localStorage.setItem('authToken', r.data.token); localStorage.setItem('userData', JSON.stringify(r.data.user)); axios.defaults.headers.common['Authorization'] = `Bearer ${r.data.token}`; setUserRole(r.data.user.role); setIsAuthenticated(true); } catch { setAuthError('Email ou senha inválidos.'); } }
  async function handleRegister(e: FormEvent) { e.preventDefault(); setAuthError(''); try { await axios.post(`${API_URL}/auth/register`, { email: registerEmail, name: registerName, password: registerPassword, companyName: registerCompanyName }); const r = await axios.post(`${API_URL}/auth/login`, { email: registerEmail, password: registerPassword }); localStorage.setItem('authToken', r.data.token); localStorage.setItem('userData', JSON.stringify(r.data.user)); axios.defaults.headers.common['Authorization'] = `Bearer ${r.data.token}`; setUserRole(r.data.user.role); setIsAuthenticated(true); } catch { setAuthError('Erro ao registrar.'); } }
  
  async function handleCreateIngredient(e: FormEvent) { e.preventDefault(); if (!newIngredientName) return; try { const r = await axios.post(`${API_URL}/ingredients`, { name: newIngredientName, stockQuantity: parseFloat(newIngredientQuantity), unit: newIngredientUnit }); setIngredients([...ingredients, r.data]); setNewIngredientName(''); setNewIngredientQuantity(''); alert('Criado!'); } catch { alert('Erro'); } }
  function handleAddIngredientToRecipe() { if (!selectedIngredientId) return; const i = ingredients.find(ig => ig.id === selectedIngredientId); if (i) { setRecipeItems([...recipeItems, { ingredientId: i.id, name: i.name, quantity: selectedIngredientQuantity }]); setSelectedIngredientQuantity(''); } }
  
  async function handleCreateProduct(e: FormEvent) { e.preventDefault(); if (!newProductName) return; const pl = { name: newProductName, price: parseFloat(newProductPrice), recipeItems: recipeItems.map(i => ({ ingredientId: i.ingredientId, quantity: parseFloat(i.quantity) })) }; try { const r = await axios.post(`${API_URL}/products`, pl); let np = r.data; if (newProductImage) { const fd = new FormData(); fd.append('image', newProductImage); const up = await axios.post(`${API_URL}/products/${np.id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); np = up.data; } setProducts([...products, np]); setNewProductName(''); setNewProductPrice(''); setRecipeItems([]); setNewProductImage(null); alert('Criado!'); } catch { alert('Erro'); } }
  async function handleCreateTransaction(e: FormEvent) { e.preventDefault(); if (!newTransactionDesc) return; const pl = { description: newTransactionDesc, amount: parseFloat(newTransactionAmount), type: newTransactionType, dueDate: newTransactionDueDate || null }; try { const r = await axios.post(`${API_URL}/financial/transactions`, pl); setTransactions([r.data, ...transactions]); setNewTransactionDesc(''); setNewTransactionAmount(''); setNewTransactionDueDate(''); alert('Registrado!'); } catch { alert('Erro'); } }
  async function handleCreateTable(e: FormEvent) { e.preventDefault(); if (!newTableName) return; try { const r = await axios.post(`${API_URL}/tables`, { name: newTableName }); setTables([...tables, r.data]); setNewTableName(''); alert('Criada!'); } catch { alert('Erro'); } }

  // --- RENDERIZAÇÃO DA COMANDA ---
  const renderOrderContent = () => (
    <Paper shadow="xs" p="md" withBorder>
      {selectedTable?.activeOrders && selectedTable.activeOrders.length > 0 && (
        <>
          <Title order={4} mb="xs" c="dimmed">Já Pedidos</Title>
          <List spacing="xs" size="sm" mb="md">
            {selectedTable.activeOrders.map(order => (
              order.items.map(item => ( <List.Item key={item.id}> <Text c="dimmed">{item.quantity}x {item.product.name} - R$ {(Number(item.product.price) * item.quantity).toFixed(2)}</Text> </List.Item> ))
            ))}
          </List>
          <Divider my="sm" />
        </>
      )}

      <Title order={4} mb="xs" c="blue">Novo Pedido</Title>
      {orderItems.length === 0 ? ( <Text c="dimmed" size="sm">Nenhum item novo.</Text> ) : (
        <ScrollArea h={isMobile ? "calc(100vh - 250px)" : 400}>
          <List spacing="sm" size="sm" mb="md">
            {orderItems.map(item => ( <List.Item key={item.id}> <Group justify="space-between"> <Text>{item.name} (x{item.quantity})</Text> <Text fw={500}>R$ {(parseFloat(item.price) * item.quantity).toFixed(2)}</Text> </Group> </List.Item> ))}
          </List>
        </ScrollArea>
      )}
      <hr />
      <Group justify="space-between" mt="md">
        <Title order={3}>Total Mesa:</Title>
        <Title order={3}>R$ {calculateTotalTable()}</Title>
      </Group>
      <Button onClick={handleFinalizeOrder} disabled={orderItems.length === 0} fullWidth color="green" mt="md" size="lg" >Enviar p/ Cozinha</Button>
    </Paper>
  );

  // --- RENDERIZAÇÃO PRINCIPAL ---
  const renderView = () => {
    switch (currentView) {
      case 'DASHBOARD':
        return (
          <Container size="lg" mt="md">
            <Title order={1} mb="xl">Dashboard</Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }} mb="xl">
              <Paper shadow="xs" p="xl" withBorder radius="md"><Title order={3} c="dimmed">Faturamento</Title><Text fz="xxl" fw={700} c="green">R$ {parseFloat(String(dashboardData.totalRevenue || 0)).toFixed(2)}</Text></Paper>
              <Paper shadow="xs" p="xl" withBorder radius="md"><Title order={3} c="dimmed">Pedidos</Title><Text fz="xxl" fw={700}>{dashboardData.orderCount}</Text></Paper>
            </SimpleGrid>
            <Title order={2} mb="md">Top Produtos</Title>
            <Table.ScrollContainer minWidth={500}>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead><Table.Tr><Table.Th>Produto</Table.Th><Table.Th>Qtd</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>{dashboardData.topProducts.map((p) => (<Table.Tr key={p.productId}><Table.Td>{p.name}</Table.Td><Table.Td>{p.quantitySold}</Table.Td></Table.Tr>))}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Container>
        );

      case 'MANAGEMENT':
        return (
          <Container size="lg" mt="md">
            <Title order={1} mb="xl">Gestão</Title>
            <Tabs value={managementSubView} onChange={setManagementSubView}>
              <Tabs.List grow>
                <Tabs.Tab value="insumos">Insumos</Tabs.Tab>
                <Tabs.Tab value="produtos">Produtos</Tabs.Tab>
                <Tabs.Tab value="mesas">Mesas</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="insumos" pt="lg">
                <Paper shadow="xs" p="md" mb="xl" withBorder component="form" onSubmit={handleCreateIngredient}>
                  <Title order={3} mb="md">Novo Insumo</Title>
                  <Stack> <TextInput label="Nome" value={newIngredientName} onChange={(e) => setNewIngredientName(e.target.value)} required /> <Group grow> <NumberInput label="Qtd" value={newIngredientQuantity} onChange={(v) => setNewIngredientQuantity(String(v))} required /> <Select label="Un" value={newIngredientUnit} onChange={(v) => setNewIngredientUnit(v || 'un')} data={['un', 'g', 'kg', 'ml', 'l']} required allowDeselect={false} /> </Group> <Button type="submit">Adicionar</Button> </Stack>
                </Paper>
                <Title order={2} mb="md">Estoque</Title>
                <Table.ScrollContainer minWidth={500}>
                  <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead> <Table.Tr> <Table.Th>Nome</Table.Th> <Table.Th>Qtd</Table.Th> <Table.Th>Un</Table.Th> </Table.Tr> </Table.Thead>
                    <Table.Tbody>{ingredients.map(ing => ( <Table.Tr key={ing.id}> <Table.Td>{ing.name}</Table.Td> <Table.Td>{parseFloat(String(ing.stockQuantity) || '0').toFixed(2)}</Table.Td> <Table.Td>{ing.unit}</Table.Td> </Table.Tr> ))}</Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Tabs.Panel>

              <Tabs.Panel value="produtos" pt="lg">
                 <Paper shadow="xs" p="md" mb="xl" withBorder component="form" onSubmit={handleCreateProduct}>
                   <Title order={3} mb="md">Novo Produto</Title>
                   <Stack> <TextInput label="Nome" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} required /> <NumberInput label="Preço" value={newProductPrice} onChange={(v) => setNewProductPrice(String(v))} required prefix="R$ " /> <FileInput label="Imagem" value={newProductImage} onChange={setNewProductImage} accept="image/*" /> <Title order={4}>Receita</Title> <Paper p="sm" withBorder bg="gray.0"> <Group grow align='flex-end'> <Select label="Ingrediente" data={ingredients.map(i => ({ value: i.id, label: i.name }))} value={selectedIngredientId} onChange={(v) => setSelectedIngredientId(v || '')} /> <NumberInput label="Qtd" value={selectedIngredientQuantity} onChange={(v) => setSelectedIngredientQuantity(String(v))} /> <Button onClick={handleAddIngredientToRecipe} variant="outline">Add</Button> </Group> </Paper> <List>{recipeItems.map((i, idx) => <List.Item key={idx}>{i.name} - {i.quantity}</List.Item>)}</List> <Button type="submit" color="green">Salvar</Button> </Stack>
                 </Paper>
                 <Title order={2} mb="md">Produtos</Title>
                 <Table.ScrollContainer minWidth={500}>
                   <Table striped highlightOnHover withTableBorder withColumnBorders>
                     <Table.Thead> <Table.Tr> <Table.Th>Img</Table.Th> <Table.Th>Nome</Table.Th> <Table.Th>Preço</Table.Th> </Table.Tr> </Table.Thead>
                     <Table.Tbody>{products.map(p => ( <Table.Tr key={p.id}> <Table.Td><Image src={p.imageUrl || ''} h={30} w={30} fit="contain" /></Table.Td> <Table.Td>{p.name}</Table.Td> <Table.Td>R$ {parseFloat(p.price).toFixed(2)}</Table.Td> </Table.Tr> ))}</Table.Tbody>
                   </Table>
                 </Table.ScrollContainer>
              </Tabs.Panel>
              
              <Tabs.Panel value="mesas" pt="lg">
                <Paper shadow="xs" p="md" mb="xl" withBorder component="form" onSubmit={handleCreateTable}>
                  <Title order={3} mb="md">Nova Mesa</Title>
                  <Group align="flex-end"> <TextInput label="Nome" value={newTableName} onChange={(e) => setNewTableName(e.target.value)} required style={{ flex: 1 }} /> <Button type="submit">Adicionar</Button> </Group>
                </Paper>
                <Title order={2} mb="md">Mesas</Title>
                <Table striped highlightOnHover withTableBorder withColumnBorders> <Table.Tbody>{tables.map(t => ( <Table.Tr key={t.id}> <Table.Td>{t.name}</Table.Td> </Table.Tr> ))}</Table.Tbody> </Table>
              </Tabs.Panel>
            </Tabs>
          </Container>
        );

      case 'FINANCIAL':
        return (
          <Container size="lg" mt="md">
            <Title order={1} mb="xl">Financeiro</Title>
            <Paper shadow="xs" p="md" mb="xl" withBorder component="form" onSubmit={handleCreateTransaction}>
              <Title order={3} mb="md">Nova Transação</Title>
              <Stack>
                <TextInput label="Descrição" value={newTransactionDesc} onChange={(e) => setNewTransactionDesc(e.target.value)} required />
                <Group grow> <NumberInput label="Valor" value={newTransactionAmount} onChange={(v) => setNewTransactionAmount(String(v))} required prefix="R$ "/> <Select label="Tipo" value={newTransactionType} onChange={(v) => setNewTransactionType(v || 'DESPESA')} data={['DESPESA', 'RECEITA']} allowDeselect={false}/> <TextInput type='date' label="Vencimento" value={newTransactionDueDate} onChange={(e) => setNewTransactionDueDate(e.target.value)} /> </Group>
                <Button type="submit">Adicionar</Button>
              </Stack>
            </Paper>
            <Title order={2} mb="md">Histórico</Title>
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead> <Table.Tr> <Table.Th>Descrição</Table.Th> <Table.Th>Valor</Table.Th> <Table.Th>Tipo</Table.Th> <Table.Th>Data</Table.Th> </Table.Tr> </Table.Thead>
                <Table.Tbody>{transactions.map(t => (<Table.Tr key={t.id}><Table.Td>{t.description}</Table.Td><Table.Td c={t.type === 'DESPESA' ? 'red' : 'green'}>{parseFloat(t.amount).toFixed(2)}</Table.Td><Table.Td>{t.type}</Table.Td><Table.Td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-'}</Table.Td></Table.Tr>))}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Container>
        );

      case 'ORDER':
        return (
          <Container size="lg" mt="md">
            <Group justify="space-between" mb="md">
              <Button onClick={handleGoBackToTables} variant="light" leftSection={'←'}>Voltar</Button>
              <Title order={3}>{selectedTable?.name}</Title>
              <Button color="red" onClick={openPaymentModal} disabled={(selectedTable?.currentTotal || 0) <= 0}>
                Fechar Conta (R$ {calculateTotalTable()})
              </Button>
            </Group>
            <Grid>
              <Grid.Col span={{ base: 12, md: 7 }}>
                <Title order={2} mb="md">Cardápio</Title>
                <ScrollArea h={600}>
                  <Stack gap="sm">{products.map(p => ( <Paper key={p.id} shadow="xs" p="md" withBorder onClick={() => addProductToOrder(p)} style={{ cursor: 'pointer' }}> <Group> <Image src={p.imageUrl || 'https://via.placeholder.com/40'} w={40} h={40} fit="cover" /> <Box style={{flex: 1}}> <Group justify="space-between"> <Text fw={500}>{p.name}</Text> <Text>R$ {parseFloat(p.price).toFixed(2)}</Text> </Group> </Box> </Group> </Paper> ))}</Stack>
                </ScrollArea>
              </Grid.Col>
              {!isMobile && ( <Grid.Col span={5}>{renderOrderContent()}</Grid.Col> )}
            </Grid>
            {isMobile && ( <> <Affix position={{ bottom: 20, right: 20 }}> <Button onClick={openCart} size="lg" radius="xl">Ver Comanda</Button> </Affix> <Drawer opened={cartDrawerOpen} onClose={closeCart} title={`Comanda - ${selectedTable?.name}`} position="bottom" size="90%"> {renderOrderContent()} </Drawer> </> )}
            
            <Modal opened={paymentModalOpen} onClose={closePaymentModal} title="Fechar Conta">
              <Stack>
                <Title order={2} ta="center">Total: R$ {Number(selectedTable?.currentTotal || 0).toFixed(2)}</Title>
                <Select label="Forma de Pagamento" data={['CREDIT', 'DEBIT', 'CASH', 'PIX']} value={paymentMethod} onChange={(v) => setPaymentMethod(v || 'CREDIT')} allowDeselect={false} />
                <Button color="red" fullWidth onClick={handlePayTab} size="lg" mt="md">Confirmar Pagamento</Button>
              </Stack>
            </Modal>
          </Container>
        );

      case 'TABLE_SELECTION':
      default:
        return (
          <Container size="lg" mt="md">
            <Title order={1} mb="xl">Mesas</Title>
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="lg" mb="xl" >
              {tables.map(table => ( 
                <Paper 
                  key={table.id} shadow="sm" p="lg" radius="md" withBorder onClick={() => handleSelectTable(table)} 
                  // ✨ USO DO BADGE PARA MOSTRAR O TOTAL ✨
                  style={{ cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }} 
                  bg={(table.currentTotal || 0) > 0 ? 'red.1' : 'green.1'} mih={100} 
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
            <Title order={1} mb="xl">Cozinha (KDS)</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {kdsOrders.filter(o => o.status === 'PENDING').length === 0 && <Text c="dimmed">Cozinha vazia.</Text>}
              {kdsOrders.filter(o => o.status === 'PENDING').map(order => (
                <Paper key={order.id} shadow="md" p="md" radius="md" withBorder bg="yellow.1">
                  <Group justify="space-between" mb="xs">
                    <Title order={4}>#{order.id.substring(0, 4)}</Title>
                    <Button size="xs" color="dark" onClick={() => handleOrderReady(order.id)}>Pronto</Button>
                  </Group>
                  <List size="sm">{order.items.map(item => ( <List.Item key={item.id}><Text span fw={700}>{item.quantity}x</Text> {item.product.name}</List.Item> ))}</List>
                </Paper>
              ))}
            </SimpleGrid>
          </Container>
        );
    }
  };
  
  if (!isAuthenticated) { 
    if (appView === 'LOGIN') return ( <Container size={420} my={40}><Title ta="center">Login</Title><Paper withBorder shadow="md" p={30} mt={30} radius="md" component="form" onSubmit={handleLogin}><Stack><TextInput label="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required /><PasswordInput label="Senha" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />{authError && <Text c="red" size="sm">{authError}</Text>}<Button type="submit" fullWidth>Entrar</Button><Anchor component="button" type="button" c="dimmed" onClick={() => setAppView('REGISTER')} size="sm" ta="center">Criar conta</Anchor></Stack></Paper></Container> );
    return ( <Container size={420} my={40}><Title ta="center">Registro</Title><Paper withBorder shadow="md" p={30} mt={30} radius="md" component="form" onSubmit={handleRegister}><Stack><TextInput label="Empresa" value={registerCompanyName} onChange={(e) => setRegisterCompanyName(e.target.value)} required /><TextInput label="Nome" value={registerName} onChange={(e) => setRegisterName(e.target.value)} required /><TextInput label="Email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} required /><PasswordInput label="Senha" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} required />{authError && <Text c="red" size="sm">{authError}</Text>}<Button type="submit" fullWidth>Registrar</Button><Anchor component="button" type="button" c="dimmed" onClick={() => setAppView('LOGIN')} size="sm" ta="center">Voltar para login</Anchor></Stack></Paper></Container> );
  }

  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !mobileOpened, desktop: true }, }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
          <Title order={3}>Meu PDV</Title>
          <Group ml="xl" gap={0} visibleFrom="sm">
            <Button variant={currentView.includes('TABLE') ? 'light' : 'subtle'} onClick={() => setCurrentView('TABLE_SELECTION')}>PDV</Button>
            {userRole === 'DONO' && <> <Button variant={currentView === 'DASHBOARD' ? 'light' : 'subtle'} onClick={() => setCurrentView('DASHBOARD')}>Dash</Button> <Button variant={currentView === 'MANAGEMENT' ? 'light' : 'subtle'} onClick={() => setCurrentView('MANAGEMENT')}>Gestão</Button> <Button variant={currentView === 'FINANCIAL' ? 'light' : 'subtle'} onClick={() => setCurrentView('FINANCIAL')}>Finan</Button> </>}
          </Group>
           <Button variant="default" ml="auto" onClick={handleLogout}>Sair</Button>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md"><Stack><Button variant="subtle" onClick={() => { setCurrentView('TABLE_SELECTION'); toggleMobile(); }}>PDV</Button>{userRole === 'DONO' && <><Button variant="subtle" onClick={() => { setCurrentView('DASHBOARD'); toggleMobile(); }}>Dash</Button><Button variant="subtle" onClick={() => { setCurrentView('MANAGEMENT'); toggleMobile(); }}>Gestão</Button><Button variant="subtle" onClick={() => { setCurrentView('FINANCIAL'); toggleMobile(); }}>Finan</Button></>}<Button variant="outline" color="red" onClick={handleLogout}>Sair</Button></Stack></AppShell.Navbar>
      <AppShell.Main><Container size="xl" p={0}>{renderView()}</Container></AppShell.Main>
    </AppShell>
  );
}

export default App;