import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

// ==================================================================
// INTERFACES (NOSSOS MOLDES DE DADOS)
// ==================================================================
interface Product { id: string; name: string; price: string; }
interface OrderItem extends Product { quantity: number; }
interface FullOrder { id: string; total: number; createdAt: string; items: { id: string; quantity: number; product: Product; }[]; }
interface DashboardData { totalRevenue: number; orderCount: number; topProducts: { productId: string; name: string; quantitySold: number; }[]; }
interface Table { id: string; name: string; }
interface Ingredient { id: string; name: string; stockQuantity: string; unit: string; }

const socket = io('http://localhost:3333');

// ==================================================================
// COMPONENTE PRINCIPAL APP
// ==================================================================
function App() {
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
  
  // --- Estados para a tela de Gestão ---
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientQuantity, setNewIngredientQuantity] = useState('');
  const [newIngredientUnit, setNewIngredientUnit] = useState('un');

  // --- Efeitos para buscar dados e ouvir eventos ---
  useEffect(() => {
    // Busca produtos apenas uma vez, pois eles mudam com menos frequência
    axios.get('http://localhost:3333/products').then(response => setProducts(response.data));
    
    // Configura o ouvinte do KDS
    socket.on('new_order', (newOrder: FullOrder) => {
      setKdsOrders(prevOrders => [newOrder, ...prevOrders]);
    });
    
    // Limpa o ouvinte ao desmontar o componente
    return () => { socket.off('new_order'); };
  }, []); // Este useEffect roda apenas uma vez, como deve ser.

  // ✨ A CORREÇÃO ESTÁ AQUI DENTRO: Este useEffect agora busca os dados da tela ativa ✨
  useEffect(() => {
    if (currentView === 'DASHBOARD') {
      axios.get('http://localhost:3333/dashboard/today').then(response => setDashboardData(response.data));
    }
    if (currentView === 'MANAGEMENT') {
      axios.get('http://localhost:3333/ingredients').then(response => setIngredients(response.data));
    }
    // A busca de mesas foi movida para cá!
    if (currentView === 'TABLE_SELECTION') {
      axios.get('http://localhost:3333/tables').then(response => setTables(response.data));
    }
  }, [currentView]); // Roda toda vez que a 'currentView' muda

  // --- Funções de Lógica de Negócio ---
  function handleSelectTable(table: Table) {
    setSelectedTable(table);
    setCurrentView('ORDER');
  }
  function handleGoBackToTables() {
    setSelectedTable(null);
    setOrderItems([]);
    setCurrentView('TABLE_SELECTION');
  }
  function addProductToOrder(product: Product) {
    const existing = orderItems.find(item => item.id === product.id);
    if (existing) {
      setOrderItems(orderItems.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setOrderItems([...orderItems, { ...product, quantity: 1 }]);
    }
  }
  const calculateTotal = () => orderItems.reduce((total, item) => total + (parseFloat(item.price) * item.quantity), 0).toFixed(2);
  async function handleFinalizeOrder() {
    const payload = { tableId: selectedTable?.id, items: orderItems.map(item => ({ productId: item.id, quantity: item.quantity })) };
    try {
      await axios.post('http://localhost:3333/orders', payload);
      alert(`Pedido para a ${selectedTable?.name} finalizado com sucesso!`);
      handleGoBackToTables();
    } catch (error) {
      console.error("Erro ao finalizar o pedido:", error);
      alert('Erro ao finalizar o pedido.');
    }
  }
  async function handleCreateIngredient(event: FormEvent) {
    event.preventDefault();
    if (!newIngredientName || !newIngredientQuantity) {
      alert('Por favor, preencha o nome e a quantidade.');
      return;
    }
    const payload = { name: newIngredientName, stockQuantity: parseFloat(newIngredientQuantity), unit: newIngredientUnit };
    try {
      const response = await axios.post('http://localhost:3333/ingredients', payload);
      setIngredients([...ingredients, response.data]);
      setNewIngredientName('');
      setNewIngredientQuantity('');
      setNewIngredientUnit('un');
      alert('Ingrediente criado com sucesso!');
    } catch (error) {
      console.error("Erro ao criar ingrediente:", error);
      alert('Erro ao criar ingrediente. Verifique se o nome já existe.');
    }
  }

  // --- Renderização dos Componentes ---
  const renderView = () => {
    switch (currentView) {
      case 'DASHBOARD':
        return (
          <div style={{ padding: '20px' }}>
            <h1>Dashboard - Vendas de Hoje</h1>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}><div style={{ border: '1px solid #ccc', padding: '20px', flex: 1, borderRadius: '8px' }}><h2 >Faturamento Total</h2><p style={{ fontSize: '24px', fontWeight: 'bold' }}>R$ {parseFloat(String(dashboardData.totalRevenue)).toFixed(2)}</p></div><div style={{ border: '1px solid #ccc', padding: '20px', flex: 1, borderRadius: '8px' }}><h2 >Total de Pedidos</h2><p style={{ fontSize: '24px', fontWeight: 'bold' }}>{dashboardData.orderCount}</p></div></div>
            <div><h2>Top 5 Produtos Mais Vendidos</h2><ul style={{ listStyle: 'none', padding: 0 }}>{dashboardData.topProducts.map((p) => <li key={p.productId} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>{p.name} - <strong>{p.quantitySold} unidades</strong></li>)}</ul></div>
          </div>
        );

      case 'MANAGEMENT':
        return (
          <div style={{ padding: '20px' }}>
            <h1>Gestão de Estoque - Insumos</h1>
            <form onSubmit={handleCreateIngredient} style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}><h2 >Adicionar Novo Insumo</h2><input type="text" placeholder="Nome (ex: Pão Brioche)" value={newIngredientName} onChange={e => setNewIngredientName(e.target.value)} style={{ marginRight: '10px', padding: '8px' }} /><input type="number" placeholder="Qtd. Inicial" value={newIngredientQuantity} onChange={e => setNewIngredientQuantity(e.target.value)} style={{ marginRight: '10px', padding: '8px' }} /><select value={newIngredientUnit} onChange={e => setNewIngredientUnit(e.target.value)} style={{ marginRight: '10px', padding: '8px' }}><option value="un">Unidade (un)</option><option value="g">Grama (g)</option><option value="kg">Quilo (kg)</option><option value="ml">Mililitro (ml)</option><option value="l">Litro (l)</option></select><button type="submit" style={{ padding: '8px 12px', background: 'royalblue', color: 'white', border: 'none' }}>Adicionar</button></form>
            <h2>Insumos em Estoque</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ background: '#f0f0f0' }}><th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Nome</th><th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Estoque Atual</th><th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Unidade</th></tr></thead><tbody>{ingredients.map(ing => (<tr key={ing.id}><td style={{ padding: '10px', border: '1px solid #ddd' }}>{ing.name}</td><td style={{ padding: '10px', border: '1px solid #ddd' }}>{parseFloat(ing.stockQuantity).toFixed(2)}</td><td style={{ padding: '10px', border: '1px solid #ddd' }}>{ing.unit}</td></tr>))}</tbody></table>
          </div>
        );

      case 'ORDER':
        return (
            <div style={{ padding: '10px' }}>
                <button onClick={handleGoBackToTables}>&larr; Voltar para Mesas</button>
                <h1>Comanda - {selectedTable?.name}</h1>
                <div style={{ display: 'flex' }}><div style={{ width: '50%', paddingRight: '10px' }}><h2 >Cardápio</h2><ul style={{ listStyle: 'none', padding: 0 }}>{products.map(p => <li key={p.id} onClick={() => addProductToOrder(p)} style={{ border: '1px solid #ccc', padding: '10px', cursor: 'pointer', marginBottom: '5px' }}>{p.name} - R$ {p.price}</li>)}</ul></div><div style={{ width: '50%', paddingLeft: '10px' }}><h2 >Itens</h2><ul style={{ listStyle: 'none', padding: 0 }}>{orderItems.map(item => <li key={item.id}>{item.name} (x{item.quantity})</li>)}</ul><hr /><h3 >Total: R$ {calculateTotal()}</h3><button onClick={handleFinalizeOrder} disabled={orderItems.length === 0} style={{ width: '100%', padding: '15px', backgroundColor: 'green', color: 'white' }}>Finalizar Pedido</button></div></div>
            </div>
        );

      case 'TABLE_SELECTION':
      default:
        return (
            <div style={{ padding: '20px' }}>
              <h1>Seleção de Mesas</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>{tables.map(table => (<div key={table.id} onClick={() => handleSelectTable(table)} style={{ border: '2px solid green', borderRadius: '10px', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 'bold' }}>{table.name}</div>))}</div>
              <hr style={{ margin: '30px 0', border: '2px solid blue' }} />
              <div><h1>KDS - Cozinha</h1><div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>{kdsOrders.length === 0 && <p>Aguardando novos pedidos...</p>}{kdsOrders.map(order => (<div key={order.id} style={{ border: '2px solid black', padding: '15px', minWidth: '250px' }}><h3 >Pedido #{order.id.substring(0, 6)}</h3><ul style={{ paddingLeft: '20px' }}>{order.items.map(item => (<li key={item.id}><strong>{item.quantity}x</strong> {item.product.name}</li>))}</ul></div>))}</div></div>
            </div>
        );
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <nav style={{ background: '#f0f0f0', padding: '10px', display: 'flex', gap: '10px', borderBottom: '1px solid #ccc' }}><button onClick={() => setCurrentView('TABLE_SELECTION')} style={{ padding: '10px', background: currentView.includes('TABLE') || currentView.includes('ORDER') ? 'royalblue' : 'white', color: currentView.includes('TABLE') || currentView.includes('ORDER') ? 'white' : 'black' }}>Mesas & PDV</button><button onClick={() => setCurrentView('DASHBOARD')} style={{ padding: '10px', background: currentView === 'DASHBOARD' ? 'royalblue' : 'white', color: currentView === 'DASHBOARD' ? 'white' : 'black' }}>Dashboard</button><button onClick={() => setCurrentView('MANAGEMENT')} style={{ padding: '10px', background: currentView === 'MANAGEMENT' ? 'royalblue' : 'white', color: currentView === 'MANAGEMENT' ? 'white' : 'black' }}>Gestão</button></nav>
      {renderView()}
    </div>
  );
}

export default App;