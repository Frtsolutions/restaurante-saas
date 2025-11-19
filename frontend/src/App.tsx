import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
// Importações do Mantine
import { AppShell, Group, Button, Title, Container, Tabs, TextInput, NumberInput, Select, Stack, Table, Paper, SimpleGrid, Text, List, Grid, ScrollArea, PasswordInput, Anchor, FileInput, Image, Box, Drawer, Affix, Burger } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';

// ==================================================================
// INTERFACES
// ==================================================================
interface Product { id: string; name: string; price: string; imageUrl: string | null; }
interface OrderItem extends Product { quantity: number; }
interface FullOrder { id:string; total: number; createdAt: string; items: { id: string; quantity: number; product: Product; }[]; }
interface DashboardData { totalRevenue: number; orderCount: number; topProducts: { productId: string; name: string; quantitySold: number; }[]; }
interface Table { id: string; name: string; }
interface Ingredient { id: string; name: string; stockQuantity: string; unit: string; }
interface FinancialTransaction {
  id: string;
  description: string;
  amount: string;
  type: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}
interface RecipeItemForm {
  ingredientId: string;
  name: string;
  quantity: string;
}
interface User {
  id: string;
  name: string;
  email: string;
  role: 'DONO' | 'CAIXA';
  companyId: string;
}

// URL da API (Render ou Local)
const API_URL = 'https://meu-pdv-backend.onrender.com'; 
const socket = io(API_URL);

// ==================================================================
// COMPONENTE PRINCIPAL APP
// ==================================================================
function App() {
  // --- Estados de Autenticação ---
  const [appView, setAppView] = useState('LOGIN');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<User['role'] | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerCompanyName, setRegisterCompanyName] = useState('');

  // --- Estados do App ---
  const [currentView, setCurrentView] = useState('TABLE_SELECTION');
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [kdsOrders, setKdsOrders] = useState<FullOrder[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({ totalRevenue: 0, orderCount: 0, topProducts: [] });
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientQuantity, setNewIngredientQuantity] = useState('');
  const [newIngredientUnit, setNewIngredientUnit] = useState('un');
  const [managementSubView, setManagementSubView] = useState<string | null>('insumos');
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [recipeItems, setRecipeItems] = useState<RecipeItemForm[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [selectedIngredientQuantity, setSelectedIngredientQuantity] = useState('');
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [newTransactionDesc, setNewTransactionDesc] = useState('');
  const [newTransactionAmount, setNewTransactionAmount] = useState('');
  const [newTransactionType, setNewTransactionType] = useState('DESPESA');
  const [newTransactionDueDate, setNewTransactionDueDate] = useState('');
  const [newTableName, setNewTableName] = useState('');
  
  // --- Hooks para UI Responsiva ---
  const [cartDrawerOpen, { open: openCart, close: closeCart }] = useDisclosure(false);
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const isMobile = useMediaQuery('(max-width: 48em)');

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
      axios.get(`${API_URL}/products`)
        .then(response => setProducts(response.data))
        .catch(error => {
          if (error.response && error.response.status === 401) handleLogout();
        });
      socket.on('new_order', (newOrder: FullOrder) => setKdsOrders(prevOrders => [newOrder, ...prevOrders]));
    }
    return () => { socket.off('new_order'); };
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && currentView) {
      if (mobileOpened) toggleMobile();

      if (userRole === 'CAIXA' && (currentView === 'DASHBOARD' || currentView === 'MANAGEMENT' || currentView === 'FINANCIAL')) {
        setCurrentView('TABLE_SELECTION');
        return;
      }
      switch (currentView) {
        case 'DASHBOARD':
          axios.get(`${API_URL}/dashboard/today`).then(response => setDashboardData(response.data)).catch(console.error);
          break;
        case 'MANAGEMENT':
          axios.get(`${API_URL}/ingredients`).then(response => {
            setIngredients(response.data);
            if(response.data.length > 0 && !selectedIngredientId) { setSelectedIngredientId(response.data[0].id); }
          }).catch(console.error);
          axios.get(`${API_URL}/products`).then(response => setProducts(response.data)).catch(console.error);
          axios.get(`${API_URL}/tables`).then(response => setTables(response.data)).catch(console.error);
          break;
        case 'TABLE_SELECTION':
          axios.get(`${API_URL}/tables`).then(response => setTables(response.data)).catch(console.error);
          break;
        case 'FINANCIAL':
          axios.get(`${API_URL}/financial/transactions`).then(response => setTransactions(response.data)).catch(console.error);
          break;
      }
    }
  }, [currentView, isAuthenticated, userRole]);


  // --- Funções ---
  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setAuthError('');
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email: loginEmail, password: loginPassword });
      const { token, user } = response.data;
      localStorage.setItem('authToken', token);
      localStorage.setItem('userData', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUserRole(user.role);
      setIsAuthenticated(true);
    } catch (error) {
      setAuthError('Email ou senha inválidos.');
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setAuthError('');
    try {
      await axios.post(`${API_URL}/auth/register`, { email: registerEmail, name: registerName, password: registerPassword, companyName: registerCompanyName });
      const loginResponse = await axios.post(`${API_URL}/auth/login`, { email: registerEmail, password: registerPassword });
      const { token, user } = loginResponse.data;
      localStorage.setItem('authToken', token);
      localStorage.setItem('userData', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUserRole(user.role);
      setIsAuthenticated(true);
    } catch (error: any) {
      setAuthError('Erro ao registrar.');
    }
  }

  function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUserRole(null);
  }

  function handleSelectTable(table: Table) { setSelectedTable(table); setCurrentView('ORDER'); }
  function handleGoBackToTables() { setSelectedTable(null); setOrderItems([]); setCurrentView('TABLE_SELECTION'); }
  function addProductToOrder(product: Product) {
    const existing = orderItems.find(item => item.id === product.id);
    if (existing) { setOrderItems(orderItems.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)); }
    else { setOrderItems([...orderItems, { ...product, quantity: 1 }]); }
  }
  const calculateTotal = () => orderItems.reduce((total, item) => total + (parseFloat(item.price) * item.quantity), 0).toFixed(2);
  
  async function handleFinalizeOrder() {
    const payload = { tableId: selectedTable?.id, items: orderItems.map(item => ({ productId: item.id, quantity: item.quantity })) };
    try { 
      await axios.post(`${API_URL}/orders`, payload); 
      alert(`Pedido ${selectedTable?.name} finalizado!`);
      if (isMobile) closeCart();
      handleGoBackToTables();
    }
    catch (error) { alert('Erro ao finalizar.'); }
  }
  
  async function handleCreateIngredient(event: FormEvent) {
    event.preventDefault(); if (!newIngredientName || !newIngredientQuantity) return;
    const payload = { name: newIngredientName, stockQuantity: parseFloat(newIngredientQuantity), unit: newIngredientUnit };
    try { const response = await axios.post(`${API_URL}/ingredients`, payload); setIngredients([...ingredients, response.data]); setNewIngredientName(''); setNewIngredientQuantity(''); alert('Criado!'); }
    catch (error) { alert('Erro ao criar.'); }
  }
  function handleAddIngredientToRecipe() {
    if (!selectedIngredientId || !selectedIngredientQuantity) return;
    const ingredient = ingredients.find(ing => ing.id === selectedIngredientId);
    if (ingredient) { setRecipeItems([...recipeItems, { ingredientId: ingredient.id, name: ingredient.name, quantity: selectedIngredientQuantity }]); setSelectedIngredientQuantity(''); }
  }
  
  async function handleCreateProduct(event: FormEvent) {
    event.preventDefault();
    if (!newProductName || !newProductPrice) return;
    const productPayload = { name: newProductName, price: parseFloat(newProductPrice), recipeItems: recipeItems.map(item => ({ ingredientId: item.ingredientId, quantity: parseFloat(item.quantity) })) };
    try {
      const productResponse = await axios.post(`${API_URL}/products`, productPayload);
      let newProduct: Product = productResponse.data;
      if (newProductImage) {
        const formData = new FormData();
        formData.append('image', newProductImage);
        const uploadResponse = await axios.post(`${API_URL}/products/${newProduct.id}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        newProduct = uploadResponse.data;
      }
      setProducts(prevProducts => [...prevProducts, newProduct]);
      setNewProductName(''); setNewProductPrice(''); setRecipeItems([]); setNewProductImage(null);
      alert('Produto criado!');
    } catch (error) { alert('Erro ao criar.'); }
  }

  async function handleCreateTransaction(event: FormEvent) {
    event.preventDefault(); if (!newTransactionDesc || !newTransactionAmount) return;
    const payload = { description: newTransactionDesc, amount: parseFloat(newTransactionAmount), type: newTransactionType, dueDate: newTransactionDueDate || null };
    try { const response = await axios.post(`${API_URL}/financial/transactions`, payload); setTransactions([response.data, ...transactions]); setNewTransactionDesc(''); setNewTransactionAmount(''); setNewTransactionDueDate(''); alert('Registrado!'); }
    catch (error) { alert('Erro.'); }
  }
  async function handleCreateTable(event: FormEvent) {
    event.preventDefault(); if (!newTableName) return;
    try { const response = await axios.post(`${API_URL}/tables`, { name: newTableName }); setTables([...tables, response.data]); setNewTableName(''); alert('Mesa criada!'); } 
    catch (error) { alert('Erro.'); }
  }

  // --- Conteúdo da Comanda Reutilizável ---
  const renderOrderContent = () => (
    <Paper shadow="xs" p="md" withBorder>
      <Title order={2} mb="md">Itens</Title>
      {orderItems.length === 0 ? ( <Text c="dimmed">Nenhum item adicionado.</Text> ) : (
        <ScrollArea h={isMobile ? "calc(100vh - 250px)" : 400}>
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
      <hr />
      <Group justify="space-between" mt="md">
        <Title order={3}>Total:</Title>
        <Title order={3}>R$ {calculateTotal()}</Title>
      </Group>
      <Button onClick={handleFinalizeOrder} disabled={orderItems.length === 0} fullWidth color="green" mt="xl" size="lg" >
        Finalizar Pedido
      </Button>
    </Paper>
  );

  // --- Renderização ---
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
            <Button onClick={handleGoBackToTables} variant="light" mb="md" leftSection={'←'}>Voltar</Button>
            <Title order={1} mb="xl">Comanda - {selectedTable?.name}</Title>
            <Grid>
              <Grid.Col span={{ base: 12, md: 7 }}>
                <Title order={2} mb="md">Cardápio</Title>
                <ScrollArea h={600}>
                  <Stack gap="sm">{products.map(p => ( <Paper key={p.id} shadow="xs" p="md" withBorder onClick={() => addProductToOrder(p)} style={{ cursor: 'pointer' }}> <Group> <Image src={p.imageUrl || 'https://via.placeholder.com/40'} w={40} h={40} fit="cover" /> <Box style={{flex: 1}}> <Group justify="space-between"> <Text fw={500}>{p.name}</Text> <Text>R$ {parseFloat(p.price).toFixed(2)}</Text> </Group> </Box> </Group> </Paper> ))}</Stack>
                </ScrollArea>
              </Grid.Col>
              {!isMobile && (
                <Grid.Col span={5}>{renderOrderContent()}</Grid.Col>
              )}
            </Grid>
            {isMobile && (
              <>
                {/* CORREÇÃO 1: Removido shadow="xl" do Button */}
                <Affix position={{ bottom: 20, right: 20 }}>
                  <Button onClick={openCart} size="lg" radius="xl">Ver Comanda ({orderItems.length})</Button>
                </Affix>
                <Drawer opened={cartDrawerOpen} onClose={closeCart} title={`Comanda - ${selectedTable?.name}`} position="bottom" size="90%">
                  {renderOrderContent()}
                </Drawer>
              </>
            )}
          </Container>
        );

      case 'TABLE_SELECTION':
      default:
        return (
          <Container size="lg" mt="md">
            <Title order={1} mb="xl">Mesas</Title>
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="lg" mb="xl" >
              {/* CORREÇÃO 2: Estilos mesclados em um único objeto */}
              {tables.map(table => ( 
                <Paper 
                  key={table.id} 
                  shadow="sm" 
                  p="lg" 
                  radius="md" 
                  withBorder 
                  onClick={() => handleSelectTable(table)} 
                  style={{ 
                    cursor: 'pointer', 
                    textAlign: 'center', 
                    backgroundColor: '#e8f5e9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }} 
                  mih={100} 
                > 
                  <Text fw={700} size="lg">{table.name}</Text> 
                </Paper> 
              ))}
            </SimpleGrid>
            <hr style={{ margin: '30px 0', border: 'none', borderTop: '2px solid lightblue' }} />
            <Title order={1} mb="xl">Cozinha (KDS)</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {kdsOrders.length === 0 && <Text c="dimmed">Nenhum pedido pendente.</Text>}
              {kdsOrders.map(order => (
                <Paper key={order.id} shadow="md" p="md" radius="md" withBorder bg="yellow.1">
                  <Title order={3} mb="sm">#{order.id.substring(0, 4)}</Title>
                  <List size="sm">{order.items.map(item => ( <List.Item key={item.id}><Text span fw={700}>{item.quantity}x</Text> {item.product.name}</List.Item> ))}</List>
                </Paper>
              ))}
            </SimpleGrid>
          </Container>
        );
    }
  };
  
  if (!isAuthenticated) {
    if (appView === 'LOGIN') {
      return (
        <Container size={420} my={40}>
          <Title ta="center">Login</Title>
          <Paper withBorder shadow="md" p={30} mt={30} radius="md" component="form" onSubmit={handleLogin}>
            <Stack>
              <TextInput label="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
              <PasswordInput label="Senha" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
              {authError && <Text c="red" size="sm">{authError}</Text>}
              <Button type="submit" fullWidth>Entrar</Button>
              <Anchor component="button" type="button" c="dimmed" onClick={() => setAppView('REGISTER')} size="sm" ta="center">Criar conta</Anchor>
            </Stack>
          </Paper>
        </Container>
      );
    }
    return (
      <Container size={420} my={40}>
        <Title ta="center">Registro</Title>
        <Paper withBorder shadow="md" p={30} mt={30} radius="md" component="form" onSubmit={handleRegister}>
          <Stack>
            <TextInput label="Empresa" value={registerCompanyName} onChange={(e) => setRegisterCompanyName(e.target.value)} required />
            <TextInput label="Nome" value={registerName} onChange={(e) => setRegisterName(e.target.value)} required />
            <TextInput label="Email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} required />
            <PasswordInput label="Senha" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} required />
            {authError && <Text c="red" size="sm">{authError}</Text>}
            <Button type="submit" fullWidth>Registrar</Button>
            <Anchor component="button" type="button" c="dimmed" onClick={() => setAppView('LOGIN')} size="sm" ta="center">Voltar para login</Anchor>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: true },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
          <Title order={3}>Meu PDV</Title>
          <Group ml="xl" gap={0} visibleFrom="sm">
            <Button variant={currentView.includes('TABLE') ? 'light' : 'subtle'} onClick={() => setCurrentView('TABLE_SELECTION')}>PDV</Button>
            {userRole === 'DONO' && <>
              <Button variant={currentView === 'DASHBOARD' ? 'light' : 'subtle'} onClick={() => setCurrentView('DASHBOARD')}>Dash</Button>
              <Button variant={currentView === 'MANAGEMENT' ? 'light' : 'subtle'} onClick={() => setCurrentView('MANAGEMENT')}>Gestão</Button>
              <Button variant={currentView === 'FINANCIAL' ? 'light' : 'subtle'} onClick={() => setCurrentView('FINANCIAL')}>Finan</Button>
            </>}
          </Group>
           <Button variant="default" ml="auto" onClick={handleLogout}>Sair</Button>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack>
          <Button variant="subtle" onClick={() => { setCurrentView('TABLE_SELECTION'); toggleMobile(); }}>Mesas & PDV</Button>
          {userRole === 'DONO' && <>
            <Button variant="subtle" onClick={() => { setCurrentView('DASHBOARD'); toggleMobile(); }}>Dashboard</Button>
            <Button variant="subtle" onClick={() => { setCurrentView('MANAGEMENT'); toggleMobile(); }}>Gestão</Button>
            <Button variant="subtle" onClick={() => { setCurrentView('FINANCIAL'); toggleMobile(); }}>Financeiro</Button>
          </>}
          <Button variant="outline" color="red" onClick={handleLogout}>Sair</Button>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="xl" p={0}>
          {renderView()}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

export default App;