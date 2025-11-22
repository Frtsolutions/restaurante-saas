import { useState, useEffect } from 'react';
import axios from 'axios';
// Importações do Mantine
import { AppShell, Burger, Button, Group, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

// ✨ IMPORTANDO AS TELAS QUE CRIAMOS ✨
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { ManagementScreen } from './screens/ManagementScreen';
import { FinancialScreen } from './screens/FinancialScreen';
import { TablesScreen, type TableData } from './screens/TablesScreen'; // Importando o componente e o tipo
import { OrderScreen } from './screens/OrderScreen';

// Interface do Usuário
interface User {
  id: string;
  name: string;
  email: string;
  role: 'DONO' | 'CAIXA';
  companyId: string;
}

function App() {
  // --- Estados de Autenticação ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<User['role'] | null>(null);

  // --- Estados de Navegação ---
  const [currentView, setCurrentView] = useState('TABLE_SELECTION');
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);

  // --- Hooks de UI (Menu Mobile) ---
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();

  // --- Efeito: Verificar Login ao Carregar ---
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userDataString = localStorage.getItem('userData');
    
    if (token && userDataString) {
      const userData: User = JSON.parse(userDataString);
      // Configura o axios globalmente com o token salvo
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUserRole(userData.role);
      setIsAuthenticated(true);
    }
  }, []);

  // --- Funções de Autenticação ---
  const handleLoginSuccess = (token: string, user: any) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('userData', JSON.stringify(user));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUserRole(user.role);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUserRole(null);
    setCurrentView('TABLE_SELECTION'); // Reseta a view para o padrão
  };

  // --- Funções de Navegação ---
  const handleSelectTable = (table: TableData) => {
    setSelectedTable(table);
    setCurrentView('ORDER');
  };

  const handleBackToTables = () => {
    setSelectedTable(null);
    setCurrentView('TABLE_SELECTION');
  };

  // --- Roteador Simples (Escolhe qual tela mostrar) ---
  const renderView = () => {
    switch (currentView) {
      case 'DASHBOARD':
        return <DashboardScreen />;
      case 'MANAGEMENT':
        return <ManagementScreen />;
      case 'FINANCIAL':
        return <FinancialScreen />;
      case 'ORDER':
        return <OrderScreen table={selectedTable} onBack={handleBackToTables} />;
      case 'TABLE_SELECTION':
      default:
        return <TablesScreen onSelectTable={handleSelectTable} />;
    }
  };

  // 1. Se não estiver logado, mostra a tela de Login
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // 2. Se estiver logado, mostra a Estrutura Principal (AppShell)
  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: true },
      }}
      padding="md"
    >
      {/* Cabeçalho com Botões */}
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
          <Title order={3}>Meu PDV</Title>
          
          <Group ml="xl" gap={0} visibleFrom="sm">
            <Button variant={currentView === 'TABLE_SELECTION' || currentView === 'ORDER' ? 'light' : 'subtle'} onClick={() => setCurrentView('TABLE_SELECTION')}>PDV</Button>
            {userRole === 'DONO' && (
              <>
                <Button variant={currentView === 'DASHBOARD' ? 'light' : 'subtle'} onClick={() => setCurrentView('DASHBOARD')}>Dash</Button>
                <Button variant={currentView === 'MANAGEMENT' ? 'light' : 'subtle'} onClick={() => setCurrentView('MANAGEMENT')}>Gestão</Button>
                <Button variant={currentView === 'FINANCIAL' ? 'light' : 'subtle'} onClick={() => setCurrentView('FINANCIAL')}>Finan</Button>
              </>
            )}
          </Group>
          
          <Button variant="default" ml="auto" onClick={handleLogout}>Sair</Button>
        </Group>
      </AppShell.Header>

      {/* Menu Lateral (Mobile) */}
      <AppShell.Navbar p="md">
        <Stack>
          <Button variant="subtle" onClick={() => { setCurrentView('TABLE_SELECTION'); toggleMobile(); }}>Mesas & PDV</Button>
          {userRole === 'DONO' && (
            <>
              <Button variant="subtle" onClick={() => { setCurrentView('DASHBOARD'); toggleMobile(); }}>Dashboard</Button>
              <Button variant="subtle" onClick={() => { setCurrentView('MANAGEMENT'); toggleMobile(); }}>Gestão</Button>
              <Button variant="subtle" onClick={() => { setCurrentView('FINANCIAL'); toggleMobile(); }}>Financeiro</Button>
            </>
          )}
          <Button variant="outline" color="red" onClick={handleLogout}>Sair</Button>
        </Stack>
      </AppShell.Navbar>

      {/* Conteúdo Principal */}
      <AppShell.Main>
        {renderView()}
      </AppShell.Main>
    </AppShell>
  );
}

export default App;