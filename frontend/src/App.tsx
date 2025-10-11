import { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

// ==================================================================
// INTERFACES (NOSSOS MOLDES DE DADOS)
// ==================================================================
interface Product {
  id: string;
  name: string;
  price: string;
}

interface OrderItem extends Product {
  quantity: number;
}

interface FullOrder {
  id: string;
  total: number;
  createdAt: string;
  items: {
    id: string;
    quantity: number;
    product: Product;
  }[];
}

interface DashboardData {
  totalRevenue: number; // A API pode mandar como string, mas trataremos na exibição
  orderCount: number;
  topProducts: {
    productId: string;
    name: string;
    quantitySold: number;
  }[];
}

// Conexão com o servidor de WebSocket
const socket = io('http://localhost:3333');

// ==================================================================
// COMPONENTE PARA O DASHBOARD
// ==================================================================
function DashboardComponent() {
  const [data, setData] = useState<DashboardData>({ totalRevenue: 0, orderCount: 0, topProducts: [] });

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await axios.get('http://localhost:3333/dashboard/today');
        setData(response.data);
      } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
      }
    }
    fetchData();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard - Vendas de Hoje</h1>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ border: '1px solid #ccc', padding: '20px', flex: 1, borderRadius: '8px' }}>
          <h2>Faturamento Total</h2>
          {/* ✨ A CORREÇÃO ESTÁ AQUI ✨ */}
          <p style={{ fontSize: '24px', fontWeight: 'bold' }}>R$ {parseFloat(String(data.totalRevenue)).toFixed(2)}</p>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '20px', flex: 1, borderRadius: '8px' }}>
          <h2>Total de Pedidos</h2>
          <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{data.orderCount}</p>
        </div>
      </div>
      <div>
        <h2>Top 5 Produtos Mais Vendidos</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {data.topProducts.map((product) => (
            <li key={product.productId} style={{ borderBottom: '1px solid #eee', padding: '10px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>{product.name}</span>
              <strong>{product.quantitySold} unidades vendidas</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ==================================================================
// COMPONENTE PARA O KDS (TELA DA COZINHA)
// ==================================================================
function KdsComponent() {
  const [orders, setOrders] = useState<FullOrder[]>([]);

  useEffect(() => {
    socket.on('new_order', (newOrder: FullOrder) => {
      setOrders(prevOrders => [newOrder, ...prevOrders]);
    });

    return () => {
      socket.off('new_order');
    };
  }, []);

  return (
    <div style={{ padding: '10px' }}>
      <h1>KDS - Cozinha</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {orders.length === 0 && <p>Aguardando novos pedidos...</p>}
        {orders.map(order => (
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
  );
}

// ==================================================================
// COMPONENTE PARA O PDV (PONTO DE VENDA)
// ==================================================================
function PdvComponent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  
  useEffect(() => {
    axios.get('http://localhost:3333/products').then(response => setProducts(response.data));
  }, []);

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
    const payload = { items: orderItems.map(item => ({ productId: item.id, quantity: item.quantity })) };
    try {
      await axios.post('http://localhost:3333/orders', payload);
      alert('Pedido finalizado com sucesso!');
      setOrderItems([]);
    } catch (error) {
      console.error("Erro ao finalizar o pedido:", error)
      alert('Erro ao finalizar o pedido.');
    }
  }

  return (
    <div style={{ display: 'flex', width: '100%' }}>
      <div style={{ width: '50%', padding: '10px' }}>
        <h1>Cardápio</h1>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {products.map(p => (
            <li 
              key={p.id} 
              onClick={() => addProductToOrder(p)} 
              style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '5px', cursor: 'pointer', borderRadius: '5px' }}
            >
              {p.name} - R$ {p.price}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ width: '50%', padding: '10px', borderLeft: '2px solid #eee' }}>
        <h1>Comanda</h1>
        {orderItems.length === 0 ? (
          <p>Nenhum item adicionado.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {orderItems.map(item => (
              <li key={item.id} style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.name} (x{item.quantity})</span>
                <span>R$ {(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
        <hr />
        <h2>Total: R$ {calculateTotal()}</h2>
        <button 
          onClick={handleFinalizeOrder} 
          disabled={orderItems.length === 0} 
          style={{ width: '100%', padding: '15px', fontSize: '16px', backgroundColor: orderItems.length === 0 ? 'grey' : 'green', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '5px' }}
        >
          Finalizar Pedido
        </button>
      </div>
    </div>
  );
}


// ==================================================================
// CONTAINER PARA JUNTAR O PDV E O KDS
// ==================================================================
function PdvAndKdsContainer() {
  return (
    <>
      <PdvComponent />
      <hr style={{ border: '2px solid blue', margin: '20px 0' }} />
      <KdsComponent />
    </>
  )
}

// ==================================================================
// COMPONENTE PRINCIPAL COM A NAVEGAÇÃO
// ==================================================================
function App() {
  const [view, setView] = useState('PDV'); // 'PDV' ou 'DASHBOARD'

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <nav style={{ background: '#f0f0f0', padding: '10px', display: 'flex', gap: '10px', borderBottom: '1px solid #ccc' }}>
        <button onClick={() => setView('PDV')} style={{ padding: '10px', fontSize: '16px', background: view === 'PDV' ? 'royalblue' : 'white', color: view === 'PDV' ? 'white' : 'black' }}>
          PDV & KDS
        </button>
        <button onClick={() => setView('DASHBOARD')} style={{ padding: '10px', fontSize: '16px', background: view === 'DASHBOARD' ? 'royalblue' : 'white', color: view === 'DASHBOARD' ? 'white' : 'black' }}>
          Dashboard
        </button>
      </nav>
      
      {view === 'PDV' && <PdvAndKdsContainer />}
      {view === 'DASHBOARD' && <DashboardComponent />}
    </div>
  );
}

export default App;