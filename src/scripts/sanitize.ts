import bcrypt from 'bcryptjs';
import { pool } from '../lib/db.js';

async function sanitizeDatabase() {
  // This script performs destructive deletes and overwrites demo tenant/service data.
  // Require an explicit operator acknowledgement before opening a database connection.
  if (process.env.CONFIRM_SANITIZE_DATABASE !== 'true') {
    throw new Error('Refusing to sanitize database without explicit confirmation. Set CONFIRM_SANITIZE_DATABASE=true only after verifying DATABASE_URL and taking a backup.');
  }

  console.log('==============================================');
  console.log('   INICIANDO SANITIZACAO DO BANCO DE DADOS    ');
  console.log('==============================================\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Snapshot Before
    const beforeTenants = (await client.query('SELECT count(*) FROM tenants')).rows[0].count;
    const beforeProviders = (await client.query('SELECT count(*) FROM providers')).rows[0].count;
    const beforeUsers = (await client.query('SELECT count(*) FROM users')).rows[0].count;
    const beforeServices = (await client.query('SELECT count(*) FROM services')).rows[0].count;
    const beforeBookings = (await client.query('SELECT count(*) FROM bookings')).rows[0].count;

    console.log('CONTAGEM ANTES DA SANITIZACAO:');
    console.log(`- Tenants: ${beforeTenants}`);
    console.log(`- Providers: ${beforeProviders}`);
    console.log(`- Users: ${beforeUsers}`);
    console.log(`- Services: ${beforeServices}`);
    console.log(`- Bookings: ${beforeBookings}\n`);

    // 2. Restaurar dados padrao de tenant-1 e tenant-2
    console.log('1. Restaurando dados oficiais dos estabelecimentos modelo (tenant-1 e tenant-2)...');
    await client.query(`
      UPDATE tenants 
      SET name = 'Barbearia Imperial',
          slug = 'barbearia-imperial',
          logo_url = '✂️',
          description = 'Cortes clássicos, barba na toalha quente e atendimento premium para quem valoriza estilo e tradição.',
          theme_color = 'indigo',
          accent_color = 'bg-indigo-600 text-white'
      WHERE id = 'tenant-1'
    `);

    await client.query(`
      UPDATE tenants 
      SET name = 'Clínica Estética Aura',
          slug = 'clinica-estetica-aura',
          logo_url = '✨',
          description = 'Tratamentos faciais, corporais e bem-estar avançado com tecnologia de ponta e equipe especializada.',
          theme_color = 'emerald',
          accent_color = 'bg-emerald-600 text-white'
      WHERE id = 'tenant-2'
    `);

    // 3. Remover usuarios de teste automatizado
    console.log('2. Removendo usuarios e clientes de teste automatizado...');
    const deletedUsers = await client.query(`
      DELETE FROM users 
      WHERE email LIKE '%@teste.com' 
         OR email LIKE '%@email.com' 
         OR email LIKE 'test.%@test.com'
         OR email LIKE 'camila.ferreira.%'
         OR email LIKE 'juliana.sobrancelhas.%'
         OR email LIKE 'prestador.%'
         OR email LIKE 'cliente.%'
         OR email LIKE 'studio.glow.%'
         OR email LIKE 'studio.estetica.%'
         OR email = 'teste@teste.com'
      RETURNING id, email
    `);
    console.log(`   -> ${deletedUsers.rowCount} usuarios de teste removidos.`);

    // 4. Remover prestadores de teste automatizado
    console.log('3. Removendo prestadores ficticios/de teste...');
    const deletedProviders = await client.query(`
      DELETE FROM providers 
      WHERE email LIKE '%@teste.com' 
         OR email LIKE '%@email.com' 
         OR email LIKE 'test.%@test.com'
         OR email LIKE 'juliana.sobrancelhas.%'
         OR email LIKE 'prestador.%'
         OR email LIKE 'studio.glow.%'
         OR email LIKE 'studio.estetica.%'
         OR (id LIKE 'provider-1787%' AND id NOT IN (SELECT provider_id FROM users WHERE provider_id IS NOT NULL))
      RETURNING id, name, email
    `);
    console.log(`   -> ${deletedProviders.rowCount} prestadores de teste removidos.`);

    // 5. Remover agendamentos de teste automatizado
    console.log('4. Removendo agendamentos de teste...');
    const deletedBookings = await client.query(`
      DELETE FROM bookings 
      WHERE client_email LIKE '%@teste.com' 
         OR client_email LIKE '%@email.com' 
         OR client_email LIKE 'test.%@test.com'
         OR client_email LIKE 'camila.ferreira.%'
         OR client_email = 'teste@teste.com'
         OR client_name LIKE 'Teste%'
      RETURNING id, client_name, client_email
    `);
    console.log(`   -> ${deletedBookings.rowCount} agendamentos de teste removidos.`);

    // 6. Limpar servicos invalidos/de teste
    console.log('5. Removendo servicos orfaos ou de teste...');
    const deletedServices = await client.query(`
      DELETE FROM services 
      WHERE provider_id NOT IN (SELECT id FROM providers)
         OR price >= 5000
      RETURNING id, name, price
    `);
    console.log(`   -> ${deletedServices.rowCount} servicos de teste removidos.`);

    // 7. Garantir servicos padrao para os provedores oficiais
    console.log('6. Assegurando integridade dos servicos oficiais...');
    const defaultServices = [
      { id: 'service-1', providerId: 'provider-1', name: 'Corte de Cabelo Clássico', desc: 'Corte com tesoura e máquina, finalizado com lavagem e pomada modeladora.', duration: 30, buffer: 10, price: 60 },
      { id: 'service-2', providerId: 'provider-1', name: 'Barba Completa com Toalha Quente', desc: 'Alinhamento com navalha, esfoliação e toalha quente aromática.', duration: 30, buffer: 10, price: 45 },
      { id: 'service-3', providerId: 'provider-2', name: 'Degradê Moderno (Fade)', desc: 'Corte degradê navalhado ou disfarçado com acabamento preciso.', duration: 45, buffer: 15, price: 70 },
      { id: 'service-4', providerId: 'provider-3', name: 'Limpeza de Pele Profunda', desc: 'Extração completa de cravos, esfoliação enzimática e máscara calmante.', duration: 60, buffer: 15, price: 150 },
      { id: 'service-5', providerId: 'provider-3', name: 'Massagem Relaxante Aromática', desc: 'Terapia com óleos essenciais para alívio de tensões e relaxamento total.', duration: 50, buffer: 10, price: 120 }
    ];

    for (const s of defaultServices) {
      await client.query(`
        INSERT INTO services (id, provider_id, name, description, duration_minutes, buffer_minutes, price)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          provider_id = EXCLUDED.provider_id,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          duration_minutes = EXCLUDED.duration_minutes,
          buffer_minutes = EXCLUDED.buffer_minutes,
          price = EXCLUDED.price
      `, [s.id, s.providerId, s.name, s.desc, s.duration, s.buffer, s.price]);
    }

    // 8. Garantir horarios de funcionamento padrao para os profissionais modelo
    console.log('7. Assegurando disponibilidade para profissionais oficiais...');
    const providersList = ['provider-1', 'provider-2', 'provider-3'];
    for (const provId of providersList) {
      const existingRules = await client.query('SELECT count(*) FROM availability_rules WHERE provider_id = $1', [provId]);
      if (parseInt(existingRules.rows[0].count) === 0) {
        for (let day = 1; day <= 5; day++) {
          await client.query(`
            INSERT INTO availability_rules (id, provider_id, day_of_week, start_time, end_time)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO NOTHING
          `, [`rule-${provId}-${day}`, provId, day, '09:00', '18:00']);
        }
      }
    }

    // 9. Contas demonstrativas: opt-in explícito, senha fornecida pelo operador e sem redefinir contas existentes.
    // A sanitização nunca deve restaurar uma senha pública/conhecida em contas reais.
    if (process.env.SEED_DEMO_USERS === 'true') {
      const seedPassword = process.env.SEED_DEMO_PASSWORD;
      if (typeof seedPassword !== 'string' || seedPassword.length < 12 || seedPassword.length > 128) {
        throw new Error('SEED_DEMO_PASSWORD must be configured with 12-128 characters when SEED_DEMO_USERS=true.');
      }

      console.log('Criando contas demonstrativas apenas por opt-in explícito...');
      const hash = await bcrypt.hash(seedPassword, 12);
      const demoUsers = [
        ['user-1', 'carlos@imperial.com', 'Carlos Barber', 'tenant-1', 'provider-1'],
        ['user-2', 'lucas@imperial.com', 'Lucas Faccini', 'tenant-1', 'provider-2'],
        ['user-3', 'heloisa@aura.com', 'Dra. Heloísa Barros', 'tenant-2', 'provider-3']
      ];
      for (const [id, email, name, tenantId, providerId] of demoUsers) {
        await client.query(
          `INSERT INTO users (id, email, password_hash, name, role, tenant_id, provider_id)
           VALUES ($1, $2, $3, $4, 'provider', $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [id, email, hash, name, tenantId, providerId]
        );
      }
    } else {
      console.log('Não foram criadas contas demonstrativas; defina SEED_DEMO_USERS=true e SEED_DEMO_PASSWORD para habilitar explicitamente.');
    }

    // Limpar regras ou excecoes orfas
    await client.query('DELETE FROM availability_rules WHERE provider_id NOT IN (SELECT id FROM providers)');
    await client.query('DELETE FROM availability_exceptions WHERE provider_id NOT IN (SELECT id FROM providers)');

    await client.query('COMMIT');

    // 10. Snapshot After
    const afterTenants = (await client.query('SELECT count(*) FROM tenants')).rows[0].count;
    const afterProviders = (await client.query('SELECT count(*) FROM providers')).rows[0].count;
    const afterUsers = (await client.query('SELECT count(*) FROM users')).rows[0].count;
    const afterServices = (await client.query('SELECT count(*) FROM services')).rows[0].count;
    const afterBookings = (await client.query('SELECT count(*) FROM bookings')).rows[0].count;

    console.log('\n==============================================');
    console.log('       SANITIZACAO CONCLUIDA COM SUCESSO!     ');
    console.log('==============================================');
    console.log('CONTAGEM FINAL:');
    console.log(`- Tenants: ${afterTenants} (mantidos todos os estabelecimentos validos)`);
    console.log(`- Providers: ${afterProviders} (apenas profissionais validos)`);
    console.log(`- Users: ${afterUsers} (apenas usuarios reais e contas modelo)`);
    console.log(`- Services: ${afterServices} (servicos limpos e padronizados)`);
    console.log(`- Bookings: ${afterBookings} (apenas reservas autenticas)`);

    // List remaining active tenants
    const remainingTenants = (await client.query('SELECT id, name, slug FROM tenants ORDER BY id ASC')).rows;
    console.log('\nESTABELECIENTOS ATIVOS NO BANCO:');
    console.table(remainingTenants);

    // List remaining active providers
    const remainingProviders = (await client.query('SELECT p.id, p.name, p.email, t.name as tenant_name FROM providers p LEFT JOIN tenants t ON p.tenant_id = t.id ORDER BY p.id ASC')).rows;
    console.log('\nPRESTADORES ATIVOS NO BANCO:');
    console.table(remainingProviders);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro durante a sanitizacao:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

sanitizeDatabase();
