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

  // ✨ LÓGICA ATUALIZADA AQUI ✨
  function addProductToOrder(productToAdd: Product) {
    // Verifica se o produto já está na comanda
    const existingItem = orderItems.find(item => item.id === productToAdd.id);

    if (existingItem) {
      // Se já existe, apenas aumenta a quantidade
      setOrderItems(orderItems.map(item => 
        item.id === productToAdd.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      // Se é um item novo, adiciona à lista com quantidade 1
      setOrderItems([...orderItems, { ...productToAdd, quantity: 1 }]);
    }
  }

  // ✨ NOVO: Função para calcular o total
  const calculateTotal = () => {
    return orderItems.reduce((total, item) => {
      return total + (parseFloat(item.price) * item.quantity);
    }, 0).toFixed(2); // .toFixed(2) para formatar como dinheiro (ex: 15.50)
  };

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

      {/* ✨ SEÇÃO DA COMANDA ATUALIZADA ✨ */}
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
      </div>

    </div>
  )
}

export default App