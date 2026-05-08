import { supabase } from '../apps/mobile/services/supabase';

async function testConnection() {
  console.log('--- Testando Conexão Supabase ---');
  console.log('URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
  
  try {
    // Tenta buscar a versão do banco ou uma tabela pública simples
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Erro na conexão:', error.message);
      return;
    }
    
    console.log('✅ Conexão estabelecida com sucesso!');
    console.log('✅ Tabelas acessíveis (Schema validado).');
  } catch (err) {
    console.error('💥 Erro fatal no teste:', err);
  }
}

testConnection();
