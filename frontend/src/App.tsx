import { useState, useEffect } from 'react';
import axios from 'axios';

interface Product {
  id: string;
  name: string;
  price: string;
}

interface OrderItem extends Product {
  quantity: number;
}

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await axios.get('http://localhost:3333/products');
        setProducts(response.data);
      } catch (error) {
        console.error("Erro ao buscar produtos:", error);
      }
    }
    fetchProducts();
  }, []);

  function addProductToOrder(productToAdd: Product) {
    const existingItem = orderItems.find(item => item.id === productToAdd.id);

    if (existingItem) {
      setOrderItems(orderItems.map(item => 
        item.id === productToAdd.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setOrderItems([...orderItems, { ...productToAdd, quantity: 1 }]);
    }
  }

  const calculateTotal = () => {
    return orderItems.reduce((total, item) => {
      return total + (parseFloat(item.price) * item.quantity);
    }, 0).toFixed(2);
  };

  // ==================================================================
  // ✨ NOSSA NOVA FUNÇÃO PARA FINALIZAR O PEDIDO
  // ==================================================================
  async function handleFinalizeOrder() {
    // 1. Prepara os dados para enviar para a API.
    //    A API espera um objeto com uma chave "items", que é uma lista.
    //    Cada item na lista precisa ter apenas 'productId' e 'quantity'.
    const payload = {
      items: orderItems.map(item => ({
        productId: item.id,
        quantity: item.quantity,
      })),
    };

    try {
      // 2. Envia os dados para o backend usando o axios.
      await axios.post('http://localhost:3333/orders', payload);

      // 3. Se tudo deu certo, mostra um alerta de sucesso e limpa a comanda.
      alert('Pedido finalizado com sucesso!');
      setOrderItems([]); // Limpa o carrinho/comanda
    } catch (error) {
      console.error("Erro ao finalizar o pedido:", error);
      alert('Houve um erro ao finalizar o pedido. Tente novamente.');
    }
  }

  return (
    <div style={{ display: 'flex', fontFamily: 'sans-serif' }}>

      <div style={{ width: '50%', padding: '10px' }}>
        <h1>Cardápio</h1>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {products.map(product => (
            <li 
              key={product.id} 
              onClick={() => addProductToOrder(product)}
              style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '5px', cursor: 'pointer' }}
            >
              {product.name} - R$ {product.price}
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
              <li key={item.id} style={{ marginBottom: '10px' }}>
                <span>{item.name} (x{item.quantity})</span>
                <span style={{ float: 'right' }}>
                  R$ {(parseFloat(item.price) * item.quantity).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <hr />
        <h2>Total: R$ {calculateTotal()}</h2>

        {/* ✨ NOSSO NOVO BOTÃO ✨ */}
        <button 
          onClick={handleFinalizeOrder}
          disabled={orderItems.length === 0} // Desabilita o botão se a comanda estiver vazia
          style={{ width: '100%', padding: '15px', fontSize: '16px', backgroundColor: 'green', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Finalizar Pedido
        </button>
      </div>

    </div>
  )
}

export default App