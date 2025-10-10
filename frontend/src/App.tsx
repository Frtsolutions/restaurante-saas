import { useState, useEffect } from 'react';
import axios from 'axios';

// ✨ NOVO: Definimos um "molde" para o nosso produto, para o TypeScript saber como ele é.
interface Product {
  id: string;
  name: string;
  price: string;
}

function App() {
  // ✨ NOVO: Criamos um "estado" para armazenar nossa lista de produtos.
  //    Começa como uma lista vazia.
  const [products, setProducts] = useState<Product[]>([]);

  // ✨ NOVO: O useEffect é um "gancho" do React que executa um código
  //    quando o componente é carregado na tela.
  useEffect(() => {
    // Função para buscar os produtos da nossa API.
    async function fetchProducts() {
      try {
        // Usamos o axios para fazer a requisição GET para nosso backend.
        const response = await axios.get('http://localhost:3333/products');
        // Quando a resposta chega, atualizamos nosso estado com a lista de produtos.
        setProducts(response.data);
      } catch (error) {
        console.error("Erro ao buscar produtos:", error);
      }
    }

    fetchProducts(); // Executamos a função.
  }, []); // O `[]` no final significa: "execute isso apenas uma vez, quando a página carregar".

  return (
    <div>
      <h1>Cardápio</h1>
      <ul>
        {/* ✨ NOVO: Usamos o .map() para transformar cada produto da nossa lista
             em um item de lista (<li>) na tela. */}
        {products.map(product => (
          <li key={product.id}>
            {product.name} - R$ {product.price}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App