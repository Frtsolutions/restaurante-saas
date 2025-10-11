import { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

// ==================================================================
// INTERFACES (MOLDES DE DADOS)
// ==================================================================
interface Product { id: string; name: string; price: string; }
interface OrderItem extends Product { quantity: number; }
interface FullOrder { id: string; total: number; createdAt: string; items: { id: string; quantity: number; product: Product; }[]; }
interface DashboardData { totalRevenue: number; orderCount: number; topProducts: { productId: string; name: string; quantitySold: number; }[]; }
interface Table { id: string; name: string; }

const socket = io('http://localhost:3333');

// ==================================================================
// COMPONENTE PRINCIPAL APP
// ==================================================================
function App() {
  // --- Estados Principais ---
  const [currentView, setCurrentView] = useState('TABLE_SELECTION'); // TABLE_SELECTION, ORDER, DASHBOARD
  const [tables, setTables] = useState<Table[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  
  // --- Estados para KDS e Dashboard ---
  const [kdsOrders, setKdsOrders] = useState<FullOrder[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({ totalRevenue: 0, orderCount: 0, topProducts: [] });

  // --- Efeitos para buscar dados e ouvir eventos ---
  useEffect(() => {
    axios.get('http://localhost:3333/tables').then(response => setTables(response.data));
    axios.get('http://localhost:3333/products').then(response => setProducts(response.data));

    socket.on('new_order', (newOrder: FullOrder) => {
      setKdsOrders(prevOrders => [newOrder, ...prevOrders]);
    });

    return () => { socket.off('new_order'); };
  }, []);

  useEffect(() => {
    if (currentView === 'DASHBOARD') {
      axios.get('http://localhost:3333/dashboard/today').then(response => setDashboardData(response.data));
    }
  }, [currentView]);

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
    const payload = {
      tableId: selectedTable?.id,
      items: orderItems.map(item => ({ productId: item.id, quantity: item.quantity })),
    };
    try {
      await axios.post('http://localhost:3333/orders', payload);
      alert(`Pedido para a ${selectedTable?.name} finalizado com sucesso!`);
      handleGoBackToTables();
    } catch (error) {
      console.error("Erro ao finalizar o pedido:", error);
      alert('Erro ao finalizar o pedido.');
    }
  }

  // --- Renderização dos Componentes ---
  const renderView = () => {
    switch (currentView) {
      case 'DASHBOARD':
        return (
            <div style={{ padding: '20px' }}>
              <h1>Dashboard - Vendas de Hoje</h1>
              <p>Faturamento Total: R$ {parseFloat(String(dashboardData.totalRevenue)).toFixed(2)}</p>
              <p>Total de Pedidos: {dashboardData.orderCount}</p>
              <h2>Top 5 Produtos</h2>
              <ul>{dashboardData.topProducts.map(p => <li key={p.productId}>{p.name} - {p.quantitySold} vendidos</li>)}</ul>
            </div>
        );
      case 'ORDER':
        return (
            <div style={{ padding: '10px' }}>
                <button onClick={handleGoBackToTables}>&larr; Voltar para Mesas</button>
                <h1>Comanda - {selectedTable?.name}</h1>
                <div style={{ display: 'flex' }}>
                    <div style={{ width: '50%' }}>
                        <h2>Cardápio</h2>
                        {products.map(p => <div key={p.id} onClick={() => addProductToOrder(p)} style={{ border: '1px solid #ccc', padding: '10px', cursor: 'pointer', marginBottom: '5px' }}>{p.name} - R$ {p.price}</div>)}
                    </div>
                    <div style={{ width: '50%', paddingLeft: '10px' }}>
                        <h2>Itens</h2>
                        {orderItems.map(item => <div key={item.id}>{item.name} (x{item.quantity})</div>)}
                        <hr />
                        <h3>Total: R$ {calculateTotal()}</h3>
                        <button onClick={handleFinalizeOrder} disabled={orderItems.length === 0}>Finalizar Pedido</button>
                    </div>
                </div>
            </div>
        );
      case 'TABLE_SELECTION':
      default:
        return (
            <div style={{ padding: '20px' }}>
              <h1>Seleção de Mesas</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                {tables.map(table => (
                  <div key={table.id} onClick={() => handleSelectTable(table)} style={{ border: '2px solid green', borderRadius: '10px', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 'bold' }}>
                    {table.name}
                  </div>
                ))}
              </div>
              <hr style={{ margin: '30px 0' }} />
              {/* KDS */}
              <div>
                <h1>KDS - Cozinha</h1>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {kdsOrders.length === 0 && <p>Aguardando novos pedidos...</p>}
                  {/* ✨ A CORREÇÃO ESTÁ AQUI DENTRO ✨ */}
                  {kdsOrders.map(order => (
                    <div key={order.id} style={{ border: '2px solid black', padding: '15px', minWidth: '250px', borderRadius: '8px' }}>
                      <h3>Pedido #{order.id.substring(0, 6)}</h3>
                      <ul style={{ paddingLeft: '20px' }}>
                        {order.items.map(item => (
                          <li key={item.id}>
                            <strong>{item.quantity}x</strong> {item.product.name}
                          </li>
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

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <nav style={{ background: '#f0f0f0', padding: '10px', display: 'flex', gap: '10px' }}>
        <button onClick={() => setCurrentView('TABLE_SELECTION')}>Mesas & PDV</button>
        <button onClick={() => setCurrentView('DASHBOARD')}>Dashboard</button>
      </nav>
      {renderView()}
    </div>
  );
}

export default App;