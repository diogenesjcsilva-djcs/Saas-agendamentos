# SchedulerSaaS

Plataforma SaaS multi-tenant de agendamentos, construída com **.NET 8** no backend e **Next.js 14** no frontend, com isolamento de dados por tenant, prevenção de conflitos de horário em nível de banco de dados e suporte nativo a fusos horários.

## ✨ Principais características

- **Multi-tenancy real**: isolamento de dados via coluna `tenant_id`, com resolução automática do tenant a partir do subdomínio e claims do JWT
- **Prevenção de overlap de agendamentos no banco**: uso de `btree_gist` e `EXCLUDE USING GIST` no PostgreSQL, garantindo que conflitos de horário sejam impossíveis mesmo sob concorrência
- **Tratamento correto de fusos horários**: NodaTime no lugar do `DateTime` nativo, eliminando bugs clássicos de UTC/local
- **Autenticação segura**: JWT com cookies `httpOnly`, via route handlers do Next.js atuando como proxy
- **Cache de disponibilidade**: Redis para consultas rápidas de horários livres
- **Jobs assíncronos**: Hangfire para lembretes e tarefas em background
- **Billing integrado**: Stripe para assinaturas e cobrança recorrente

## 🏗️ Arquitetura

### Backend (.NET 8)

Solução dividida em três projetos, seguindo separação de responsabilidades:

```
SchedulerSaaS.Domain          # Entidades, regras de negócio, sem dependências externas
SchedulerSaaS.Infrastructure  # EF Core, PostgreSQL, Redis, Hangfire, implementações
SchedulerSaaS.Api             # Controllers, middlewares, configuração da aplicação
```

**Stack**: ASP.NET Core 8 · Entity Framework Core · PostgreSQL · NodaTime · Redis · Hangfire

**Componentes-chave**:
- `TenantResolutionMiddleware` — resolve o tenant atual a partir das claims do JWT
- EF Core Global Query Filters — garantem que queries nunca vazem dados entre tenants
- Constraint `EXCLUDE USING GIST` — bloqueia overlaps de agendamento diretamente no schema do banco

### Frontend (Next.js 14)

- App Router com suporte a **subdomínios por tenant**
- Route handlers atuando como proxy para a API, mantendo cookies `httpOnly` fora do alcance do JavaScript no cliente
- Tipos TypeScript gerados a partir do schema OpenAPI da API

## 🚀 Como rodar localmente

### Pré-requisitos
- .NET 8 SDK
- Node.js 18+
- PostgreSQL (com extensão `btree_gist`)
- Redis

### Backend

```bash
cd SchedulerSaaS.Api
dotnet restore
dotnet ef database update
dotnet run
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

> ⚠️ Configure as variáveis de ambiente (connection string do PostgreSQL, Redis, chaves do Stripe e segredo JWT) antes de iniciar. Veja `.env.example`.

## 📋 Roadmap

- [ ] `docker-compose.yml` para orquestrar API, banco, Redis e frontend
- [ ] Autenticação completa e emissão de JWT
- [ ] Proteção da rota `/dashboard`
- [ ] Integração de billing com Stripe
- [ ] Testes automatizados (unitários e integração)
- [ ] Geração de tipos TypeScript a partir do OpenAPI com backend em produção

## 🛠️ Decisões técnicas

| Decisão | Motivo |
|---|---|
| NodaTime em vez de `DateTime` | Evita bugs de conversão UTC/local em agendamentos |
| `tenant_id` + Global Query Filters | Isolamento de dados simples e à prova de erro humano |
| `EXCLUDE USING GIST` no Postgres | Conflitos de horário travados no banco, não só na aplicação |
| Cookies `httpOnly` via proxy Next.js | Tokens JWT nunca expostos ao JavaScript do cliente |

## 📄 Licença

Defina aqui a licença do projeto (ex: MIT, proprietária, etc).
