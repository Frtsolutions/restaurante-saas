import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
// ✨ Importações do Mantine (ADICIONADAS Grid, ScrollArea, etc.) ✨
import { AppShell, Group, Button, Title, Container, Tabs, TextInput, NumberInput, Select, Stack, Table, Paper, SimpleGrid, Text, List, Grid, ScrollArea } from '@mantine/core';

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
  // --- Estados --- (Sem alterações)
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
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [newTransactionDesc, setNewTransactionDesc] = useState('');
  const [newTransactionAmount, setNewTransactionAmount] = useState('');
  const [newTransactionType, setNewTransactionType] = useState('DESPESA');
  const [newTransactionDueDate, setNewTransactionDueDate] = useState('');

  // --- Efeitos --- (SEU CÓDIGO - SEM ALTERAÇÕES)
  useEffect(() => {
    axios.get('http://localhost:3333/products')
      .then(response => setProducts(response.data))
      .catch(error => console.error("Erro ao buscar produtos:", error));

    socket.on('new_order', (newOrder: FullOrder) => setKdsOrders(prevOrders => [newOrder, ...prevOrders]));
    return () => { socket.off('new_order'); };
  }, []);

  useEffect(() => {
    console.log("Mudando para a view:", currentView);
    if (currentView === 'DASHBOARD') {
      axios.get('http://localhost:3333/dashboard/today')
        .then(response => setDashboardData(response.data))
        .catch(error => console.error("Erro ao buscar dashboard:", error));
    }
    if (currentView === 'MANAGEMENT') {
      axios.get('http://localhost:3333/ingredients')
        .then(response => {
          setIngredients(response.data);
          if (response.data.length > 0 && !selectedIngredientId) {
            setSelectedIngredientId(response.data[0].id);
          }
        })
        .catch(error => console.error("Erro ao buscar ingredientes:", error));
      axios.get('http://localhost:3333/products')
        .then(response => setProducts(response.data))
        .catch(error => console.error("Erro ao buscar produtos (gestão):", error));
    }
    if (currentView === 'TABLE_SELECTION') {
      axios.get('http://localhost:3333/tables')
        .then(response => setTables(response.data))
        .catch(error => console.error("Erro ao buscar mesas:", error));
    }
    if (currentView === 'FINANCIAL') {
      axios.get('http://localhost:3333/financial/transactions')
        .then(response => setTransactions(response.data))
        .catch(error => console.error("Erro ao buscar transações:", error));
    }
  }, [currentView]);


  // --- Funções --- (SEU CÓDIGO - SEM ALTERAÇÕES)
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

  // --- Renderização --- (APENAS 'ORDER' FOI ALTERADO)
  const renderView = () => {
    switch (currentView) {
      // TELA DE DASHBOARD (SEU JSX ORIGINAL - SEM ALTERAÇÕES)
      case 'DASHBOARD':
        return (
          <div style={{ padding: '20px' }}>
            <h1>Dashboard - Vendas de Hoje</h1>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <div style={{ border: '1px solid #ccc', padding: '20px', flex: 1, borderRadius: '8px' }}>
                <h2>Faturamento Total</h2>
                <p style={{ fontSize: '24px', fontWeight: 'bold' }}>R$ {parseFloat(String(dashboardData.totalRevenue || 0)).toFixed(2)}</p>
              </div>
              <div style={{ border: '1px solid #ccc', padding: '20px', flex: 1, borderRadius: '8px' }}>
                <h2>Total de Pedidos</h2>
                <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{dashboardData.orderCount}</p>
              </div>
            </div>
            <div>
              <h2>Top 5 Produtos Mais Vendidos</h2>
              <ul style={{ listStyle: 'none', padding: 0 }}>{dashboardData.topProducts.map((p) => <li key={p.productId} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>{p.name} - <strong>{p.quantitySold} unidades</strong></li>)}</ul>
            </div>
          </div>
        );

      // TELA DE GESTÃO (REFATORADA ANTERIORMENTE - SEM ALTERAÇÕES NESTA ETAPA)
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

      // TELA FINANCEIRA (REFATORADA ANTERIORMENTE - SEM ALTERAÇÕES NESTA ETAPA)
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

      // --- ✨ TELA DE COMANDA REFATORADA COM MANTINE ✨ ---
      case 'ORDER':
        return (
          <Container size="lg" mt="md">
            <Button onClick={handleGoBackToTables} variant="light" mb="md" leftSection={'←'}>
              Voltar para Mesas
            </Button>
            <Title order={1} mb="xl">Comanda - {selectedTable?.name}</Title>
            
            <Grid> {/* Grid para dividir a tela */}
              
              {/* Coluna da Esquerda: Cardápio */}
              <Grid.Col span={{ base: 12, md: 7 }}> {/* Ocupa 7 de 12 colunas em telas médias/grandes */}
                <Title order={2} mb="md">Cardápio</Title>
                <ScrollArea h={600}> {/* Área de rolagem para o cardápio */}
                  <Stack gap="sm"> {/* Empilha os produtos */}
                    {products.map(p => (
                      <Paper 
                        key={p.id} 
                        shadow="xs" 
                        p="md" 
                        withBorder 
                        onClick={() => addProductToOrder(p)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Group justify="space-between">
                          <Text fw={500}>{p.name}</Text>
                          <Text>R$ {parseFloat(p.price).toFixed(2)}</Text>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </ScrollArea>
              </Grid.Col>

              {/* Coluna da Direita: Comanda/Itens */}
              <Grid.Col span={{ base: 12, md: 5 }}> {/* Ocupa 5 de 12 colunas */}
                <Paper shadow="xs" p="md" withBorder>
                  <Title order={2} mb="md">Itens</Title>
                  {orderItems.length === 0 ? (
                    <Text c="dimmed">Nenhum item adicionado.</Text>
                  ) : (
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
                  <Button 
                    onClick={handleFinalizeOrder} 
                    disabled={orderItems.length === 0}
                    fullWidth // Ocupa 100% da largura
                    color="green" 
                    mt="xl" // Margem superior
                    size="lg" // Botão grande
                  >
                    Finalizar Pedido
                  </Button>
                </Paper>
              </Grid.Col>

            </Grid>
          </Container>
        );

      // TELA DE MESAS & KDS (SEU JSX ORIGINAL - SEM ALTERAÇÕES)
      case 'TABLE_SELECTION':
      default:
        return (
            <div style={{ padding: '20px' }}>
              <h1>Seleção de Mesas</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>{tables.map(table => (<div key={table.id} onClick={() => handleSelectTable(table)} style={{ border: '2px solid green', borderRadius: '10px', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 'bold', background: '#e8f5e9' }}>{table.name}</div>))}</div>
              <hr style={{ margin: '30px 0', border: '2px solid lightblue' }} />
              <div>
                <h1>KDS - Cozinha</h1>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {kdsOrders.length === 0 && <p>Aguardando novos pedidos...</p>}
                  {kdsOrders.map(order => (
                    <div key={order.id} style={{ border: '2px solid black', padding: '15px', minWidth: '250px', borderRadius: '8px', background: '#fff9c4' }}>
                      <h3>Pedido #{order.id.substring(0, 6)}</h3>
                      <ul style={{ paddingLeft: '20px' }}>
                        {order.items.map(item => (
                          <li key={item.id}><strong>{item.quantity}x</strong> {item.product.name}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        );
    }
  };

  // --- ESTRUTURA PRINCIPAL COM APPSHELL --- (Sem alterações)
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