import { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client'; // ✨ NOVO: Importamos o socket.io-client

// --- Interfaces (Tipos) ---
interface Product {
  id: string;
  name: string;
  price: string;
}

interface OrderItem extends Product {
  quantity: number;
}

// ✨ NOVO: Tipagem completa para o pedido que vem do backend
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

// Conecta ao nosso backend.
const socket = io('http://localhost:3333');

// ==================================================================
// ✨ NOVO: Componente dedicado para o KDS
// ==================================================================
function KdsComponent() {
  const [orders, setOrders] = useState<FullOrder[]>([]);

  useEffect(() => {
    // "Ouvinte" para o evento 'new_order'
    socket.on('new_order', (newOrder: FullOrder) => {
      // Adiciona o novo pedido no início da lista, para aparecer primeiro
      setOrders(prevOrders => [newOrder, ...prevOrders]);
    });

    // Limpa o ouvinte quando o componente é desmontado para evitar vazamentos de memória
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
          <div key={order.id} style={{ border: '2px solid black', padding: '15px', minWidth: '250px' }}>
            <h3>Pedido #{order.id.substring(0, 6)}</h3>
            <ul>
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
// Componente do PDV (nosso código anterior, agora encapsulado)
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
      alert('Erro ao finalizar o pedido.');
    }
  }

  return (
    <div style={{ display: 'flex', width: '100%' }}>
      <div style={{ width: '50%', padding: '10px' }}>
        <h1>Cardápio</h1>
        {products.map(p => <li key={p.id} onClick={() => addProductToOrder(p)} style={{ border: '1px solid #ccc', padding: '10px', listStyle: 'none', cursor: 'pointer' }}>{p.name} - R$ {p.price}</li>)}
      </div>
      <div style={{ width: '50%', padding: '10px', borderLeft: '2px solid #eee' }}>
        <h1>Comanda</h1>
        {orderItems.map(item => <li key={item.id} style={{ listStyle: 'none' }}>{item.name} (x{item.quantity})</li>)}
        <hr />
        <h2>Total: R$ {calculateTotal()}</h2>
        <button onClick={handleFinalizeOrder} disabled={orderItems.length === 0} style={{ width: '100%', padding: '15px', backgroundColor: 'green', color: 'white' }}>Finalizar Pedido</button>
      </div>
    </div>
  );
}

// ==================================================================
// Componente Principal que renderiza tudo
// ==================================================================
function App() {
  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <PdvComponent />
      <hr style={{ border: '2px solid blue', margin: '20px 0' }} />
      <KdsComponent />
    </div>
  );
}

export default App;