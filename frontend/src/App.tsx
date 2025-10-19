import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
// ✨ Importações do Mantine (ADICIONADAS as necessárias para o Financeiro) ✨
import { AppShell, Group, Button, Title, Container, Tabs, TextInput, NumberInput, Select, Stack, Table, Paper } from '@mantine/core'; // Adicionado Container, Title, Paper, Stack, TextInput, NumberInput, Select, Table

// ==================================================================
// INTERFACES (SEU CÓDIGO - SEM ALTERAÇÕES)
// ==================================================================
interface Product { id: string; name: string; price: string; }
interface OrderItem extends Product { quantity: number; }
interface FullOrder { id: string; total: number; createdAt: string; items: { id: string; quantity: number; product: Product; }[]; }
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
  // --- Estados --- (SEU CÓDIGO - SEM ALTERAÇÕES)
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
  const [managementSubView, setManagementSubView] = useState('INSUMOS');
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

  // --- Efeitos --- (SEU CÓDIGO COM LOGS - SEM ALTERAÇÕES)
  useEffect(() => {
    console.log("[EFFECT 1] Buscando produtos na montagem inicial...");
    axios.get('http://localhost:3333/products')
      .then(response => {
        console.log("[EFFECT 1] Produtos recebidos:", response.data.length);
        setProducts(response.data);
      })
      .catch(error => console.error("[EFFECT 1] ERRO ao buscar produtos:", error));

    console.log("[EFFECT 1] Configurando listener do Socket.IO...");
    socket.on('new_order', (newOrder: FullOrder) => {
        console.log("[SOCKET] Novo pedido recebido:", newOrder.id);
        setKdsOrders(prevOrders => [newOrder, ...prevOrders]);
    });

    return () => {
        console.log("[EFFECT 1] Limpando listener do Socket.IO.");
        socket.off('new_order');
    };
  }, []);

  useEffect(() => {
    console.log(`[EFFECT 2] View mudou para: ${currentView}. Buscando dados...`);
    switch (currentView) {
      case 'DASHBOARD':
        axios.get('http://localhost:3333/dashboard/today')
          .then(response => {
            console.log("[EFFECT 2] Dados do Dashboard recebidos:", response.data);
            setDashboardData(response.data);
          })
          .catch(error => console.error("[EFFECT 2] ERRO ao buscar dashboard:", error));
        break;
      case 'MANAGEMENT':
        console.log("[EFFECT 2] Buscando Ingredientes para Gestão...");
        axios.get('http://localhost:3333/ingredients')
          .then(response => {
            console.log("[EFFECT 2] Ingredientes recebidos:", response.data.length);
            setIngredients(response.data);
            if (response.data.length > 0 && !selectedIngredientId) {
              console.log("[EFFECT 2] Definindo ingrediente padrão selecionado.");
              setSelectedIngredientId(response.data[0].id);
            }
          })
          .catch(error => console.error("[EFFECT 2] ERRO ao buscar ingredientes:", error));

        console.log("[EFFECT 2] Buscando Produtos para Gestão...");
        axios.get('http://localhost:3333/products')
          .then(response => {
            console.log("[EFFECT 2] Produtos (gestão) recebidos:", response.data.length);
            setProducts(response.data);
          })
          .catch(error => console.error("[EFFECT 2] ERRO ao buscar produtos (gestão):", error));
        break;
      case 'TABLE_SELECTION':
        console.log("[EFFECT 2] Buscando Mesas...");
        axios.get('http://localhost:3333/tables')
          .then(response => {
            console.log("[EFFECT 2] Mesas recebidas:", response.data.length);
            setTables(response.data);
          })
          .catch(error => console.error("[EFFECT 2] ERRO ao buscar mesas:", error));
        break;
      case 'FINANCIAL':
        console.log("[EFFECT 2] Buscando Transações Financeiras...");
        axios.get('http://localhost:3333/financial/transactions')
          .then(response => {
            console.log("[EFFECT 2] Transações recebidas:", response.data.length);
            setTransactions(response.data);
          })
          .catch(error => console.error("[EFFECT 2] ERRO ao buscar transações:", error));
        break;
      default:
        console.log(`[EFFECT 2] Nenhuma busca de dados específica para a view: ${currentView}`);
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

  // --- Renderização --- (APENAS 'FINANCIAL' FOI ALTERADO)
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

      // TELA DE GESTÃO (SEU JSX ORIGINAL - SEM ALTERAÇÕES)
      case 'MANAGEMENT':
        return (
          <div style={{ padding: '20px' }}>
            <h1>Gestão</h1>
            <nav style={{ marginBottom: '20px' }}><button onClick={() => setManagementSubView('INSUMOS')} style={{ padding: '10px', background: managementSubView === 'INSUMOS' ? 'lightblue' : 'white', border: '1px solid #ccc' }}>Gestão de Insumos</button><button onClick={() => setManagementSubView('PRODUTOS')} style={{ padding: '10px', background: managementSubView === 'PRODUTOS' ? 'lightblue' : 'white', border: '1px solid #ccc' }}>Gestão de Produtos</button></nav>
            {managementSubView === 'INSUMOS' && (
              <div>
                <h2>Gestão de Estoque - Insumos</h2>
                <form onSubmit={handleCreateIngredient} style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}><h2>Adicionar Novo Insumo</h2><input type="text" placeholder="Nome (ex: Pão Brioche)" value={newIngredientName} onChange={e => setNewIngredientName(e.target.value)} style={{ marginRight: '10px', padding: '8px' }} /><input type="number" step="0.01" placeholder="Qtd. Inicial" value={newIngredientQuantity} onChange={e => setNewIngredientQuantity(e.target.value)} style={{ marginRight: '10px', padding: '8px' }} /><select value={newIngredientUnit} onChange={e => setNewIngredientUnit(e.target.value)} style={{ marginRight: '10px', padding: '8px' }}><option value="un">Unidade (un)</option><option value="g">Grama (g)</option><option value="kg">Quilo (kg)</option><option value="ml">Mililitro (ml)</option><option value="l">Litro (l)</option></select><button type="submit" style={{ padding: '8px 12px', background: 'royalblue', color: 'white', border: 'none', borderRadius: '4px' }}>Adicionar</button></form>
                <h2>Insumos em Estoque</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ background: '#f0f0f0' }}><th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Nome</th><th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Estoque Atual</th><th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Unidade</th></tr></thead><tbody>{ingredients.map(ing => (<tr key={ing.id}><td style={{ padding: '10px', border: '1px solid #ddd' }}>{ing.name}</td><td style={{ padding: '10px', border: '1px solid #ddd' }}>{parseFloat(ing.stockQuantity).toFixed(2)}</td><td style={{ padding: '10px', border: '1px solid #ddd' }}>{ing.unit}</td></tr>))}</tbody></table>
              </div>
            )}
            {managementSubView === 'PRODUTOS' && (
              <div>
                <h2>Gestão de Produtos</h2>
                <form onSubmit={handleCreateProduct} style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
                  <h2>Adicionar Novo Produto</h2>
                  <div style={{ marginBottom: '10px' }}><label>Nome do Produto: </label><input type="text" value={newProductName} onChange={e => setNewProductName(e.target.value)} style={{ padding: '8px', marginLeft: '5px' }} /></div>
                  <div style={{ marginBottom: '20px' }}><label>Preço de Venda (R$): </label><input type="number" step="0.01" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} style={{ padding: '8px', marginLeft: '5px' }} /></div>
                  <h3>Ficha Técnica (Receita)</h3>
                  <div style={{ background: '#f9f9f9', padding: '10px', border: '1px solid #eee', marginBottom: '10px' }}>
                    <select value={selectedIngredientId} onChange={e => setSelectedIngredientId(e.target.value)} style={{ padding: '8px' }}>{ingredients.length === 0 && <option>Carregando...</option>}{ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}</select>
                    <input type="number" step="0.01" placeholder="Quantidade" value={selectedIngredientQuantity} onChange={e => setSelectedIngredientQuantity(e.target.value)} style={{ margin: '0 10px', padding: '8px' }} />
                    <button type="button" onClick={handleAddIngredientToRecipe} style={{ padding: '8px 12px', background: 'darkorange', color: 'white', border: 'none', borderRadius: '4px' }}>Adicionar Ingrediente</button>
                  </div>
                  <ul>{recipeItems.map((item, index) => <li key={index}>{item.name} - {item.quantity} {ingredients.find(ing => ing.id === item.ingredientId)?.unit}</li>)}</ul>
                  <hr />
                  <button type="submit" style={{ padding: '10px 15px', background: 'green', color: 'white', border: 'none', borderRadius: '4px' }}>Salvar Novo Produto</button>
                </form>
                <h2>Produtos Cadastrados</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ background: '#f0f0f0' }}><th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Nome</th><th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Preço (R$)</th></tr></thead><tbody>{products.map(p => (<tr key={p.id}><td style={{ padding: '10px', border: '1px solid #ddd' }}>{p.name}</td><td style={{ padding: '10px', border: '1px solid #ddd' }}>{parseFloat(p.price).toFixed(2)}</td></tr>))}</tbody></table>
              </div>
            )}
          </div>
        );

      // --- ✨ TELA FINANCEIRA REFATORADA COM MANTINE ✨ ---
      case 'FINANCIAL':
        return (
          <Container size="lg" mt="md"> {/* Usando Container Mantine */}
            <Title order={1} mb="xl">Financeiro - Contas a Pagar/Receber</Title>

            {/* Formulário de Nova Transação */}
            <Paper shadow="xs" p="md" mb="xl" withBorder component="form" onSubmit={handleCreateTransaction}>
              <Title order={3} mb="md">Registrar Nova Transação</Title>
              <Stack> {/* Empilha os inputs */}
                <TextInput
                  label="Descrição"
                  placeholder="Ex: Aluguel, Compra de Mercadoria"
                  value={newTransactionDesc}
                  onChange={(event) => setNewTransactionDesc(event.currentTarget.value)}
                  required
                />
                <Group grow> {/* Agrupa Valor, Tipo e Data */}
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
                   {/* Mantendo o input date nativo por simplicidade */}
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
                    <Table.Td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Container>
        );

      // TELA DE COMANDA (SEU JSX ORIGINAL - SEM ALTERAÇÕES)
      case 'ORDER':
        return (
            <div style={{ padding: '10px' }}>
                <button onClick={handleGoBackToTables} style={{ marginBottom: '10px', padding: '8px 12px', background: '#eee', border: '1px solid #ccc', borderRadius: '4px' }}>&larr; Voltar para Mesas</button>
                <h1>Comanda - {selectedTable?.name}</h1>
                <div style={{ display: 'flex' }}>
                    <div style={{ width: '50%', paddingRight: '10px' }}>
                        <h2>Cardápio</h2>
                        <ul style={{ listStyle: 'none', padding: 0 }}>{products.map(p => <li key={p.id} onClick={() => addProductToOrder(p)} style={{ border: '1px solid #ccc', padding: '10px', cursor: 'pointer', marginBottom: '5px', borderRadius: '4px' }}>{p.name} - R$ {p.price}</li>)}</ul>
                    </div>
                    <div style={{ width: '50%', paddingLeft: '10px' }}>
                        <h2>Itens</h2>
                        <ul style={{ listStyle: 'none', padding: 0 }}>{orderItems.map(item => <li key={item.id}>{item.name} (x{item.quantity})</li>)}</ul>
                        <hr />
                        <h3>Total: R$ {calculateTotal()}</h3>
                        <button onClick={handleFinalizeOrder} disabled={orderItems.length === 0} style={{ width: '100%', padding: '15px', backgroundColor: orderItems.length === 0 ? 'grey' : 'green', color: 'white', border: 'none', borderRadius: '4px', cursor: orderItems.length === 0 ? 'not-allowed' : 'pointer' }}>Finalizar Pedido</button>
                    </div>
                </div>
            </div>
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