import { useState, useEffect } from 'react';
import type { FormEvent } from 'react'; // ✨ CORREÇÃO: 'type' adicionado aqui
import axios from 'axios';
import {
  Container, Title, Tabs, Paper, Stack, TextInput, Group,
  NumberInput, Select, Button, Table, FileInput, List, Image
} from '@mantine/core';

// Configuração da URL
const API_URL = 'https://meu-pdv-backend.onrender.com';

// Interfaces locais
interface Product { id: string; name: string; price: string; imageUrl: string | null; }
interface TableData { id: string; name: string; } // Renomeado para evitar conflito com o componente Table
interface Ingredient { id: string; name: string; stockQuantity: string; unit: string; }
interface RecipeItemForm { ingredientId: string; name: string; quantity: string; }

export function ManagementScreen() {
  // Estados de Dados
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<TableData[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>('insumos');

  // Estados Form Insumos
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientQuantity, setNewIngredientQuantity] = useState('');
  const [newIngredientUnit, setNewIngredientUnit] = useState('un');

  // Estados Form Produtos
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [recipeItems, setRecipeItems] = useState<RecipeItemForm[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [selectedIngredientQuantity, setSelectedIngredientQuantity] = useState('');

  // Estados Form Mesas
  const [newTableName, setNewTableName] = useState('');

  // Buscar dados ao carregar a tela
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ingRes, prodRes, tableRes] = await Promise.all([
        axios.get(`${API_URL}/ingredients`),
        axios.get(`${API_URL}/products`),
        axios.get(`${API_URL}/tables`)
      ]);
      setIngredients(ingRes.data);
      setProducts(prodRes.data);
      setTables(tableRes.data);

      // Seleciona o primeiro ingrediente por padrão se houver
      if (ingRes.data.length > 0) {
        setSelectedIngredientId(ingRes.data[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar dados de gestão:", error);
    }
  };

  // --- Funções de Ação ---

  async function handleCreateIngredient(e: FormEvent) {
    e.preventDefault();
    if (!newIngredientName || !newIngredientQuantity) return;
    
    try {
      const payload = { name: newIngredientName, stockQuantity: parseFloat(newIngredientQuantity), unit: newIngredientUnit };
      const res = await axios.post(`${API_URL}/ingredients`, payload);
      setIngredients([...ingredients, res.data]);
      setNewIngredientName('');
      setNewIngredientQuantity('');
      alert('Insumo criado!');
    } catch { alert('Erro ao criar insumo.'); }
  }

  async function handleCreateProduct(e: FormEvent) {
    e.preventDefault();
    if (!newProductName || !newProductPrice) return;

    const productPayload = {
      name: newProductName,
      price: parseFloat(newProductPrice),
      recipeItems: recipeItems.map(i => ({
        ingredientId: i.ingredientId,
        quantity: parseFloat(i.quantity)
      }))
    };

    try {
      const res = await axios.post(`${API_URL}/products`, productPayload);
      let newProduct = res.data;

      if (newProductImage) {
        const fd = new FormData();
        fd.append('image', newProductImage);
        const up = await axios.post(`${API_URL}/products/${newProduct.id}/upload`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        newProduct = up.data;
      }

      setProducts([...products, newProduct]);
      setNewProductName('');
      setNewProductPrice('');
      setRecipeItems([]);
      setNewProductImage(null);
      alert('Produto criado!');
    } catch { alert('Erro ao criar produto.'); }
  }

  function handleAddIngredientToRecipe() {
    if (!selectedIngredientId || !selectedIngredientQuantity) return;
    const i = ingredients.find(ig => ig.id === selectedIngredientId);
    if (i) {
      setRecipeItems([...recipeItems, { ingredientId: i.id, name: i.name, quantity: selectedIngredientQuantity }]);
      setSelectedIngredientQuantity('');
    }
  }

  async function handleCreateTable(e: FormEvent) {
    e.preventDefault();
    if (!newTableName) return;
    try {
      const res = await axios.post(`${API_URL}/tables`, { name: newTableName });
      setTables([...tables, res.data]);
      setNewTableName('');
      alert('Mesa criada!');
    } catch { alert('Erro ao criar mesa.'); }
  }

  return (
    <Container size="lg" mt="md">
      <Title order={1} mb="xl">Gestão</Title>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List grow>
          <Tabs.Tab value="insumos">Insumos</Tabs.Tab>
          <Tabs.Tab value="produtos">Produtos</Tabs.Tab>
          <Tabs.Tab value="mesas">Mesas</Tabs.Tab>
        </Tabs.List>

        {/* ABA INSUMOS */}
        <Tabs.Panel value="insumos" pt="lg">
          <Paper shadow="xs" p="md" mb="xl" withBorder component="form" onSubmit={handleCreateIngredient}>
            <Title order={3} mb="md">Novo Insumo</Title>
            <Stack>
              <TextInput label="Nome" value={newIngredientName} onChange={(e) => setNewIngredientName(e.target.value)} required />
              <Group grow>
                <NumberInput label="Qtd" value={newIngredientQuantity} onChange={(v) => setNewIngredientQuantity(String(v))} required />
                <Select label="Un" value={newIngredientUnit} onChange={(v) => setNewIngredientUnit(v || 'un')} data={['un', 'g', 'kg', 'ml', 'l']} required allowDeselect={false} />
              </Group>
              <Button type="submit">Adicionar</Button>
            </Stack>
          </Paper>
          <Title order={2} mb="md">Estoque</Title>
          <Table.ScrollContainer minWidth={500}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead><Table.Tr><Table.Th>Nome</Table.Th><Table.Th>Qtd</Table.Th><Table.Th>Un</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {ingredients.map(ing => (
                  <Table.Tr key={ing.id}>
                    <Table.Td>{ing.name}</Table.Td>
                    <Table.Td>{parseFloat(String(ing.stockQuantity)).toFixed(2)}</Table.Td>
                    <Table.Td>{ing.unit}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>

        {/* ABA PRODUTOS */}
        <Tabs.Panel value="produtos" pt="lg">
          <Paper shadow="xs" p="md" mb="xl" withBorder component="form" onSubmit={handleCreateProduct}>
            <Title order={3} mb="md">Novo Produto</Title>
            <Stack>
              <TextInput label="Nome" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} required />
              <NumberInput label="Preço" value={newProductPrice} onChange={(v) => setNewProductPrice(String(v))} required prefix="R$ " />
              <FileInput label="Imagem" value={newProductImage} onChange={setNewProductImage} accept="image/*" />
              
              <Title order={4}>Receita</Title>
              <Paper p="sm" withBorder bg="gray.0">
                <Group grow align='flex-end'>
                  <Select label="Ingrediente" data={ingredients.map(i => ({ value: i.id, label: i.name }))} value={selectedIngredientId} onChange={(v) => setSelectedIngredientId(v || '')} />
                  <NumberInput label="Qtd" value={selectedIngredientQuantity} onChange={(v) => setSelectedIngredientQuantity(String(v))} />
                  <Button onClick={handleAddIngredientToRecipe} variant="outline">Add</Button>
                </Group>
              </Paper>
              <List>
                {recipeItems.map((i, idx) => <List.Item key={idx}>{i.name} - {i.quantity}</List.Item>)}
              </List>
              <Button type="submit" color="green">Salvar</Button>
            </Stack>
          </Paper>
          <Title order={2} mb="md">Produtos</Title>
          <Table.ScrollContainer minWidth={500}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead><Table.Tr><Table.Th>Img</Table.Th><Table.Th>Nome</Table.Th><Table.Th>Preço</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {products.map(p => (
                  <Table.Tr key={p.id}>
                    <Table.Td><Image src={p.imageUrl || ''} h={30} w={30} fit="contain" /></Table.Td>
                    <Table.Td>{p.name}</Table.Td>
                    <Table.Td>R$ {parseFloat(p.price).toFixed(2)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>

        {/* ABA MESAS */}
        <Tabs.Panel value="mesas" pt="lg">
          <Paper shadow="xs" p="md" mb="xl" withBorder component="form" onSubmit={handleCreateTable}>
            <Title order={3} mb="md">Nova Mesa</Title>
            <Group align="flex-end">
              <TextInput label="Nome" value={newTableName} onChange={(e) => setNewTableName(e.target.value)} required style={{ flex: 1 }} />
              <Button type="submit">Adicionar</Button>
            </Group>
          </Paper>
          <Title order={2} mb="md">Mesas</Title>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Tbody>
              {tables.map(t => (
                <Table.Tr key={t.id}><Table.Td>{t.name}</Table.Td></Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}