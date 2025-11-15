import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
// Importações do Mantine (Completas)
import { AppShell, Group, Button, Title, Container, Tabs, TextInput, NumberInput, Select, Stack, Table, Paper, SimpleGrid, Text, List, Grid, ScrollArea, PasswordInput } from '@mantine/core';

// ==================================================================
// INTERFACES (SEU CÓDIGO - SEM ALTERAÇÕES)
// ==================================================================
interface Product { id: string; name: string; price: string; }
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

const socket = io('http://localhost:3333');

// ==================================================================
// COMPONENTE PRINCIPAL APP
// ==================================================================
function App() {
  // --- Estados de Autenticação ✨ ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // --- Estados de Navegação e Dados Globais ---
  const [currentView, setCurrentView] = useState('TABLE_SELECTION');
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  
  // --- Estados do PDV ---
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  
  // --- Estados do KDS e Dashboard ---
  const [kdsOrders, setKdsOrders] = useState<FullOrder[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({ totalRevenue: 0, orderCount: 0, topProducts: [] });
  
  // --- Estados da Gestão de Insumos ---
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientQuantity, setNewIngredientQuantity] = useState('');
  const [newIngredientUnit, setNewIngredientUnit] = useState('un');
  
  // --- Estados da Gestão de Produtos ---
  const [managementSubView, setManagementSubView] = useState<string | null>('insumos');
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [recipeItems, setRecipeItems] = useState<RecipeItemForm[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [selectedIngredientQuantity, setSelectedIngredientQuantity] = useState('');

  // --- Estados para a tela Financeira ---
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [newTransactionDesc, setNewTransactionDesc] = useState('');
  const [newTransactionAmount, setNewTransactionAmount] = useState('');
  const [newTransactionType, setNewTransactionType] = useState('DESPESA');
  const [newTransactionDueDate, setNewTransactionDueDate] = useState('');

  // --- Efeitos ---
  // ✨ NOVO: useEffect para verificar o token no localStorage ao carregar ✨
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      console.log("Token encontrado no localStorage, configurando axios...");
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsAuthenticated(true);
    } else {
      console.log("Nenhum token encontrado, usuário precisa logar.");
    }

    // Busca produtos (agora protegido, mas o token já foi setado se existir)
    axios.get('http://localhost:3333/products')
      .then(response => setProducts(response.data))
      .catch(error => {
        console.error("Erro ao buscar produtos:", error);
        // Se der erro 401 (não autorizado), desloga o usuário
        if (error.response && error.response.status === 401) {
          handleLogout();
        }
      });

    socket.on('new_order', (newOrder: FullOrder) => setKdsOrders(prevOrders => [newOrder, ...prevOrders]));
    return () => { socket.off('new_order'); };
  }, []); // Roda apenas uma vez

  // useEffect que busca dados da view atual
  useEffect(() => {
    // Só busca dados se estiver autenticado E houver uma view
    if (isAuthenticated && currentView) {
      console.log(`[EFFECT 2] View mudou para: ${currentView}. Buscando dados...`);
      switch (currentView) {
        case 'DASHBOARD':
          axios.get('http://localhost:3333/dashboard/today').then(response => setDashboardData(response.data)).catch(error => console.error("Erro ao buscar dashboard:", error));
          break;
        case 'MANAGEMENT':
          axios.get('http://localhost:3333/ingredients').then(response => {
            setIngredients(response.data);
            if(response.data.length > 0 && !selectedIngredientId) { setSelectedIngredientId(response.data[0].id); }
          }).catch(error => console.error("Erro ao buscar ingredientes:", error));
          axios.get('http://localhost:3333/products').then(response => setProducts(response.data)).catch(error => console.error("Erro ao buscar produtos (gestão):", error));
          break;
        case 'TABLE_SELECTION':
          axios.get('http://localhost:3333/tables').then(response => setTables(response.data)).catch(error => console.error("Erro ao buscar mesas:", error));
          break;
        case 'FINANCIAL':
          axios.get('http://localhost:3333/financial/transactions').then(response => setTransactions(response.data)).catch(error => console.error("Erro ao buscar transações:", error));
          break;
        default:
          console.log(`[EFFECT 2] Nenhuma busca de dados específica para a view: ${currentView}`);
      }
    }
  }, [currentView, isAuthenticated]); // Adicionado isAuthenticated


  // --- Funções de Autenticação ✨ ---
  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setAuthError('');
    try {
      const response = await axios.post('http://localhost:3333/auth/login', {
        email: loginEmail,
        password: loginPassword,
      });
      const { token } = response.data;
      localStorage.setItem('authToken', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Erro de login:", error);
      setAuthError('Email ou senha inválidos. Tente novamente.');
    }
  }

  function handleLogout() {
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
  }

  // --- Funções de Lógica de Negócio --- (COMPLETAS)
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
    try { await axios.post('http://localhost:3333/orders', payload); alert(`Pedido ${selectedTable?.name} finalizado!`); handleGoBackToTables(); }
    catch (error) { console.error("Erro...", error); alert('Erro...'); }
  }
  async function handleCreateIngredient(event: FormEvent) {
    event.preventDefault(); if (!newIngredientName || !newIngredientQuantity) { alert('Preencha nome/qtd.'); return; }
    const payload = { name: newIngredientName, stockQuantity: parseFloat(newIngredientQuantity), unit: newIngredientUnit };
    try { const response = await axios.post('http://localhost:3333/ingredients', payload); setIngredients([...ingredients, response.data]); setNewIngredientName(''); setNewIngredientQuantity(''); setNewIngredientUnit('un'); alert('Ingrediente criado!'); }
    catch (error) { console.error("Erro...", error); alert('Erro...'); }
  }
  function handleAddIngredientToRecipe() {
    if (!selectedIngredientId || !selectedIngredientQuantity) { alert('Selecione ingrediente/qtd.'); return; }
    const ingredient = ingredients.find(ing => ing.id === selectedIngredientId);
    if (ingredient) { setRecipeItems([...recipeItems, { ingredientId: ingredient.id, name: ingredient.name, quantity: selectedIngredientQuantity }]); setSelectedIngredientQuantity(''); }
  }
  async function handleCreateProduct(event: FormEvent) {
    event.preventDefault(); if (!newProductName || !newProductPrice) { alert('Preencha nome/preço.'); return; }
    const payload = { name: newProductName, price: parseFloat(newProductPrice), recipeItems: recipeItems.map(item => ({ ingredientId: item.ingredientId, quantity: parseFloat(item.quantity) })) };
    try { const response = await axios.post('http://localhost:3333/products', payload); setProducts([...products, response.data]); setNewProductName(''); setNewProductPrice(''); setRecipeItems([]); alert('Produto criado!'); }
    catch (error) { console.error('Erro...', error); alert('Erro...'); }
  }
  async function handleCreateTransaction(event: FormEvent) {
    event.preventDefault(); if (!newTransactionDesc || !newTransactionAmount) { alert('Preencha desc/valor.'); return; }
    const payload = { description: newTransactionDesc, amount: parseFloat(newTransactionAmount), type: newTransactionType, dueDate: newTransactionDueDate || null };
    try { const response = await axios.post('http://localhost:3333/financial/transactions', payload); setTransactions([response.data, ...transactions]); setNewTransactionDesc(''); setNewTransactionAmount(''); setNewTransactionType('DESPESA'); setNewTransactionDueDate(''); alert('Transação registrada!'); }
    catch (error) { console.error('Erro...', error); alert('Erro...'); }
  }

  // --- Renderização das Views --- (COMPLETAS)
  const renderView = () => {
    switch (currentView) {
      case 'DASHBOARD':
        return (
          <Container size="lg" mt="md">
            <Title order={1} mb="xl">Dashboard - Vendas de Hoje</Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }} mb="xl">
              <Paper shadow="xs" p="xl" withBorder radius="md">
                <Title order={3} c="dimmed">Faturamento Total</Title>
                <Text fz="xxl" fw={700} c="green">
                  R$ {parseFloat(String(dashboardData.totalRevenue || 0)).toFixed(2)}
                </Text>
              </Paper>
              <Paper shadow="xs" p="xl" withBorder radius="md">
                <Title order={3} c="dimmed">Total de Pedidos</Title>
                <Text fz="xxl" fw={700}>
                  {dashboardData.orderCount}
                </Text>
              </Paper>
            </SimpleGrid>
            <Title order={2} mb="md">Top 5 Produtos Mais Vendidos</Title>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Produto</Table.Th>
                  <Table.Th>Unidades Vendidas</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dashboardData.topProducts.map((p) => (
                  <Table.Tr key={p.productId}>
                    <Table.Td>{p.name}</Table.Td>
                    <Table.Td>{p.quantitySold}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Container>
        );

      case 'MANAGEMENT':
        return (
          <Container size="lg" mt="md">
            <Title order={1} mb="xl">Gestão</Title>
            <Tabs value={managementSubView} onChange={setManagementSubView}>
              <Tabs.List grow> <Tabs.Tab value="insumos">Gestão de Insumos</Tabs.Tab> <Tabs.Tab value="produtos">Gestão de Produtos</Tabs.Tab> </Tabs.List>
              <Tabs.Panel value="insumos" pt="lg">
                <Title order={2} mb="lg">Gestão de Estoque - Insumos</Title>
                <Paper shadow="xs" p="md" mb="xl" withBorder component="form" onSubmit={handleCreateIngredient}>
                  <Title order={3} mb="md">Adicionar Novo Insumo</Title>
                  <Stack> <TextInput label="Nome do Insumo" placeholder="Ex: Pão Brioche" value={newIngredientName} onChange={(event) => setNewIngredientName(event.currentTarget.value)} required /> <Group grow> <NumberInput label="Quantidade Inicial" placeholder="Ex: 100" value={newIngredientQuantity} onChange={(value) => setNewIngredientQuantity(String(value))} min={0} step={0.01} decimalScale={2} required /> <Select label="Unidade" value={newIngredientUnit} onChange={(value) => setNewIngredientUnit(value || 'un')} data={[{ value: 'un', label: 'Unidade (un)' }, { value: 'g', label: 'Grama (g)' }, { value: 'kg', label: 'Quilo (kg)' }, { value: 'ml', label: 'Mililitro (ml)' }, { value: 'l', label: 'Litro (l)' },]} required allowDeselect={false} /> </Group> <Button type="submit" mt="md">Adicionar Insumo</Button> </Stack>
                </Paper>
                <Title order={2} mb="md">Insumos em Estoque</Title>
                <Table striped highlightOnHover withTableBorder withColumnBorders> <Table.Thead> <Table.Tr> <Table.Th>Nome</Table.Th> <Table.Th>Estoque Atual</Table.Th> <Table.Th>Unidade</Table.Th> </Table.Tr> </Table.Thead> <Table.Tbody>{ingredients.map(ing => ( <Table.Tr key={ing.id}> <Table.Td>{ing.name}</Table.Td> <Table.Td>{parseFloat(String(ing.stockQuantity) || '0').toFixed(2)}</Table.Td> <Table.Td>{ing.unit}</Table.Td> </Table.Tr> ))}</Table.Tbody> </Table>
              </Tabs.Panel>
              <Tabs.Panel value="produtos" pt="lg">
                 <Title order={2} mb="lg">Gestão de Produtos</Title>
                 <Paper shadow="xs" p="md" mb="xl" withBorder component="form" onSubmit={handleCreateProduct}>
                   <Title order={3} mb="md">Adicionar Novo Produto</Title>
                   <Stack> <TextInput label="Nome do Produto" value={newProductName} onChange={(event) => setNewProductName(event.currentTarget.value)} required /> <NumberInput label="Preço de Venda (R$)" value={newProductPrice} onChange={(value) => setNewProductPrice(String(value))} min={0} step={0.01} decimalScale={2} required prefix="R$ " /> <Title order={4} mt="md">Ficha Técnica (Receita)</Title> <Paper p="sm" withBorder style={{ background: '#f9f9f9' }}> <Group grow align='flex-end'> <Select label="Ingrediente" placeholder="Selecione..." value={selectedIngredientId} onChange={(value) => setSelectedIngredientId(value || '')} data={ingredients.map(ing => ({ value: ing.id, label: `${ing.name} (${ing.unit})` }))} searchable clearable nothingFoundMessage="Nenhum ingrediente encontrado" /> <NumberInput label="Quantidade" value={selectedIngredientQuantity} onChange={(value) => setSelectedIngredientQuantity(String(value))} min={0} step={0.01} decimalScale={2} /> <Button onClick={handleAddIngredientToRecipe} variant="outline">Adicionar</Button> </Group> </Paper> <Paper p="xs" mt="xs">{recipeItems.length === 0 && <span style={{color: 'grey'}}>Nenhum ingrediente adicionado</span>}<ul>{recipeItems.map((item, index) => <li key={index}>{item.name} - {item.quantity} {ingredients.find(ing => ing.id === item.ingredientId)?.unit}</li>)}</ul></Paper> <Button type="submit" mt="md" color="green">Salvar Novo Produto</Button> </Stack>
                 </Paper>
                 <Title order={2} mb="md">Produtos Cadastrados</Title>
                 <Table striped highlightOnHover withTableBorder withColumnBorders> <Table.Thead> <Table.Tr> <Table.Th>Nome</Table.Th> <Table.Th>Preço (R$)</Table.Th> </Table.Tr> </Table.Thead> <Table.Tbody>{products.map(p => ( <Table.Tr key={p.id}> <Table.Td>{p.name}</Table.Td> <Table.Td>R$ {parseFloat(p.price).toFixed(2)}</Table.Td> </Table.Tr> ))}</Table.Tbody> </Table>
              </Tabs.Panel>
            </Tabs>
          </Container>
        );

      case 'FINANCIAL':
        return (
          <Container size="lg" mt="md">
            <Title order={1} mb="xl">Financeiro - Contas a Pagar/Receber</Title>
            <Paper shadow="xs" p="md" mb="xl" withBorder component="form" onSubmit={handleCreateTransaction}>
              <Title order={3} mb="md">Registrar Nova Transação</Title>
              <Stack>
                <TextInput label="Descrição" placeholder="Ex: Aluguel, Compra de Mercadoria" value={newTransactionDesc} onChange={(event) => setNewTransactionDesc(event.currentTarget.value)} required />
                <Group grow>
                  <NumberInput label="Valor (R$)" placeholder="Ex: 150.50" value={newTransactionAmount} onChange={(value) => setNewTransactionAmount(String(value))} min={0} step={0.01} decimalScale={2} required prefix="R$ "/>
                  <Select label="Tipo" value={newTransactionType} onChange={(value) => setNewTransactionType(value || 'DESPESA')} data={[{ value: 'DESPESA', label: 'Despesa' }, { value: 'RECEITA', label: 'Receita' },]} required allowDeselect={false}/>
                   <TextInput type='date' label="Data de Vencimento (Opcional)" value={newTransactionDueDate} onChange={(event) => setNewTransactionDueDate(event.currentTarget.value)} />
                </Group>
                <Button type="submit" mt="md">Adicionar Transação</Button>
              </Stack>
            </Paper>
            <Title order={2} mb="md">Histórico de Transações</Title>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead> <Table.Tr> <Table.Th>Descrição</Table.Th> <Table.Th>Valor (R$)</Table.Th> <Table.Th>Tipo</Table.Th> <Table.Th>Vencimento</Table.Th> </Table.Tr> </Table.Thead>
              <Table.Tbody>{transactions.map(t => (<Table.Tr key={t.id}><Table.Td>{t.description}</Table.Td><Table.Td style={{ color: t.type === 'DESPESA' ? 'red' : 'green' }}>{parseFloat(t.amount).toFixed(2)}</Table.Td><Table.Td>{t.type}</Table.Td><Table.Td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-'}</Table.Td></Table.Tr>))}</Table.Tbody>
            </Table>
          </Container>
        );

      case 'ORDER':
        return (
          <Container size="lg" mt="md">
            <Button onClick={handleGoBackToTables} variant="light" mb="md" leftSection={'←'}>
              Voltar para Mesas
            </Button>
            <Title order={1} mb="xl">Comanda - {selectedTable?.name}</Title>
            <Grid>
              <Grid.Col span={{ base: 12, md: 7 }}>
                <Title order={2} mb="md">Cardápio</Title>
                <ScrollArea h={600}>
                  <Stack gap="sm">
                    {products.map(p => (
                      <Paper key={p.id} shadow="xs" p="md" withBorder onClick={() => addProductToOrder(p)} style={{ cursor: 'pointer' }}>
                        <Group justify="space-between">
                          <Text fw={500}>{p.name}</Text>
                          <Text>R$ {parseFloat(p.price).toFixed(2)}</Text>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </ScrollArea>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Paper shadow="xs" p="md" withBorder>
                  <Title order={2} mb="md">Itens</Title>
                  {orderItems.length === 0 ? ( <Text c="dimmed">Nenhum item adicionado.</Text> ) : (
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
              </Grid.Col>
            </Grid>
          </Container>
        );

      case 'TABLE_SELECTION':
      default:
        return (
          <Container size="lg" mt="md">
            <Title order={1} mb="xl">Seleção de Mesas</Title>
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="lg" mb="xl" >
              {tables.map(table => (
                <Paper key={table.id} shadow="sm" p="lg" radius="md" withBorder onClick={() => handleSelectTable(table)} style={{ cursor: 'pointer', textAlign: 'center', backgroundColor: '#e8f5e9' }} mih={120} >
                  <Text fw={700} size="xl">{table.name}</Text>
                </Paper>
              ))}
            </SimpleGrid>
            <hr style={{ margin: '30px 0', border: 'none', borderTop: '2px solid lightblue' }} />
            <div>
              <Title order={1} mb="xl">KDS - Cozinha</Title>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                {kdsOrders.length === 0 && <Text c="dimmed">Aguardando novos pedidos...</Text>}
                {kdsOrders.map(order => (
                  <Paper key={order.id} shadow="md" p="md" radius="md" withBorder style={{ background: '#fff9c4' }}>
                    <Title order={3} mb="sm">Pedido #{order.id.substring(0, 6)}</Title>
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
  };
  
  // --- ✨ RENDERIZAÇÃO PRINCIPAL (CONDICIONAL) ✨ ---
  // Se não estiver autenticado, mostra a tela de Login
  if (!isAuthenticated) {
    return (
      <Container size={420} my={40}>
        <Title ta="center">Login - Meu PDV</Title>
        <Paper withBorder shadow="md" p={30} mt={30} radius="md" component="form" onSubmit={handleLogin}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="seu@email.com"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Senha"
              placeholder="Sua senha"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.currentTarget.value)}
              required
            />
            {authError && <Text c="red" size="sm">{authError}</Text>}
            <Button type="submit" mt="md">Entrar</Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  // Se ESTIVER autenticado, mostra o AppShell completo
  return (
    <AppShell padding="md" header={{ height: 60 }}>
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={3}>Meu PDV</Title>
          <Group justify="flex-end" style={{ flex: 1 }}>
            <Button variant={currentView.includes('TABLE') || currentView.includes('ORDER') ? 'filled' : 'subtle'} onClick={() => setCurrentView('TABLE_SELECTION')}>Mesas & PDV</Button>
            <Button variant={currentView === 'DASHBOARD' ? 'filled' : 'subtle'} onClick={() => setCurrentView('DASHBOARD')}>Dashboard</Button>
            <Button variant={currentView === 'MANAGEMENT' ? 'filled' : 'subtle'} onClick={() => setCurrentView('MANAGEMENT')}>Gestão</Button>
            <Button variant={currentView === 'FINANCIAL' ? 'filled' : 'subtle'} onClick={() => setCurrentView('FINANCIAL')}>Financeiro</Button>
            <Button variant="outline" color="red" onClick={handleLogout}>Sair</Button> {/* ✨ Botão de Logout ✨ */}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="xl">
          {renderView()}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

export default App;