# Relatório de correções de segurança — SaaS Agendamentos

**Data:** 2026-10-15  
**Branch:** `security/fix-auth-authorization`  
**Escopo:** revisão estática e correções no código de autenticação/autorização da API. Nenhum ambiente de produção foi acessado e nenhum teste contra banco real foi executado.

## Resumo executivo

Foram aplicadas correções em uma branch separada, sem alterar diretamente a branch `main`. As mudanças endurecem o controle de acesso em operações destrutivas, removem o segredo JWT de fallback, bloqueiam o login social que confiava em dados enviados pelo cliente, restringem o cadastro público ao papel de cliente e aplicam rate limiting nos endpoints de autenticação e criação de agendamento.

**Importante:** as mudanças ainda precisam passar por instalação de dependências, verificação TypeScript/build e testes de integração antes de serem mescladas ou implantadas. A auditoria foi estática; não significa que toda a aplicação esteja livre de vulnerabilidades.

## Correções realizadas

### 1. Escrita de serviços sem autenticação — corrigido na API

**Antes:** `POST /services`, `PUT /services/:id` e `DELETE /services/:id` não exigiam token. A edição/exclusão localizava o recurso apenas pelo ID, sem confirmar o profissional proprietário.

**Mudança:**
- Os três endpoints agora usam `authMiddleware`.
- Exigem usuário com papel `provider` e `providerId`.
- A criação deriva o `providerId` do token autenticado, ignorando o ID enviado pelo cliente.
- Edição e exclusão filtram pelo ID do serviço **e** pelo `provider_id` do profissional autenticado.
- Exclusão retorna 404 quando não há serviço correspondente àquele profissional.

**Efeito esperado:** reduz criação/alteração/exclusão anônima e acesso horizontal a serviços de outros profissionais.

### 2. Exclusão de agendamento sem autenticação — corrigido na API

**Antes:** `DELETE /bookings/:id` apagava um agendamento usando somente o ID da URL.

**Mudança:** exige token, aceita apenas profissional autenticado com `providerId` e executa a exclusão com filtro simultâneo por ID e proprietário. Cliente recebe 403 e deve usar o fluxo de cancelamento existente.

**Efeito esperado:** impede exclusão anônima e impede um profissional de excluir agendamento de outro profissional.

### 3. Segredo JWT padrão conhecido — corrigido no middleware e emissores

**Antes:** o código usava `pulse-saas-secret-key-12345678` quando `JWT_SECRET` não estava definido. Em ambiente mal configurado, isso poderia permitir a falsificação de tokens.

**Mudança:** foi criado `getJwtSecret()`, que exige `JWT_SECRET` configurado com pelo menos 32 caracteres. O middleware e os pontos de emissão de tokens usam essa função; o fallback fixo foi removido.

**Ação operacional obrigatória:** configurar um segredo forte e aleatório de pelo menos 32 caracteres no ambiente de execução. A ausência ou o tamanho insuficiente causa falha de autenticação/emissão, em vez de recorrer a um valor público. Planeje invalidar tokens antigos após a implantação, se houver suspeita de que o segredo antigo foi usado em produção.

### 4. Login social que confiava em e-mail enviado pelo cliente — mitigado com desativação segura

**Antes:** `POST /auth/social-login` aceitava `email`, `name` e `provider` do corpo da requisição sem validar um token emitido pelo provedor social. O fluxo podia localizar uma conta pelo e-mail informado e emitir JWT para ela.

**Mudança:** o endpoint retorna HTTP 501 e não emite token. A funcionalidade deve permanecer desativada até implementar validação no servidor do token OAuth/OIDC, incluindo emissor, audiência, assinatura, expiração e e-mail verificado.

**Impacto funcional:** login social fica temporariamente indisponível; login com e-mail e senha continua sendo o caminho suportado.

### 5. Cadastro público com papel e tenant controlados pelo cliente — corrigido com restrição

**Antes:** o cadastro público aceitava `role`, `tenantId` e dados de categoria/perfil, podendo criar um profissional associado a um tenant escolhido no corpo da requisição.

**Mudança:** o cadastro público cria somente usuários `client` e não aceita tenant/profissional escolhido pelo cliente. A criação de profissional deve ocorrer pelo fluxo de onboarding do estabelecimento, que associa IDs no servidor.

**Impacto funcional:** o auto-cadastro público não cria mais contas de profissional. Confirmar que o onboarding existente cria corretamente o usuário proprietário do tenant.

### 6. Rate limiting declarado mas não aplicado — corrigido parcialmente

**Antes:** os limitadores de autenticação e agendamento eram definidos, mas não aplicados aos endpoints de login, cadastro e criação de agendamento.

**Mudança:** aplicado `authRateLimiter` em cadastro, login e no endpoint de login social desativado; aplicado `bookingRateLimiter` à criação de agendamento.

**Limitação:** o limitador continua em memória local; em múltiplas instâncias, os contadores não são compartilhados. Para produção distribuída, migrar para Redis ou mecanismo equivalente. A identificação do IP agora usa `req.ip`, evitando confiar diretamente em `X-Forwarded-For`; configurar `trust proxy` somente conforme a topologia real do deployment.

## Pontos que permanecem pendentes de validação

1. **Isolamento multi-tenant completo:** as correções cobrem as rotas acima, mas é necessário revisar todas as consultas e tabelas para garantir que cada operação de leitura/escrita seja limitada ao tenant correto. Não declarar isolamento completo sem essa revisão.
2. **Estado e transições de agendamento:** revisar uma lista permitida de estados em `PATCH /bookings/:id`, permissões por papel e transições válidas.
3. **Reagendamento e concorrência:** testar autorização, fuso horário, intervalos e corrida entre reservas simultâneas; considerar restrições/locks no banco.
4. **Validação de entrada:** revisar tipos, limites numéricos, comprimento de campos, e-mail normalizado e senha mínima em todos os endpoints.
5. **Rate limiting em produção:** usar armazenamento compartilhado quando houver múltiplas réplicas e configurar proxy confiável corretamente.
6. **Configuração e gestão de segredo:** definir `JWT_SECRET` no ambiente de deployment, não em código ou commit; usar secret manager e plano de rotação.
7. **Testes automatizados:** cobrir 401 sem token, 403 para papel errado, tentativa de acesso a recursos de outro profissional/tenant, segredo ausente/fraco, login social sem validação, e respostas 429.
8. **Documentação:** o README e o manifesto de dependências aparentam descrever stacks diferentes. Atualizar documentação após confirmar a arquitetura e o comando de build correto.

## Arquivos alterados

- `src/lib/api-routes.ts` — autorização de serviços/agendamentos, cadastro, login social e aplicação de limitadores.
- `src/lib/auth-middleware.ts` — validação centralizada do segredo JWT.
- `src/lib/rate-limiter.ts` — IP resolvido pelo Express em vez de confiar diretamente no cabeçalho enviado pelo cliente.
- `docs/RELATORIO-SEGURANCA.md` — este relatório.

## Validação realizada

- Conferência estática dos trechos modificados e verificações de presença/ausência dos padrões críticos durante a edição.
- Não foi executado `npm install`, `npm run lint`, build, suíte de testes ou teste contra banco real nesta sessão.
- Não houve deploy nem alteração direta da branch `main`.

## Próximos passos recomendados

1. Configurar `JWT_SECRET` forte no ambiente de teste.
2. Executar `npm ci` (se houver lockfile), `npm run lint` e `npm run build`.
3. Corrigir erros de compilação e adicionar testes de autorização.
4. Testar o fluxo de onboarding de profissional e o cancelamento de agendamento.
5. Revisar isolamento multi-tenant completo.
6. Revisar e aprovar o pull request antes de mesclar.
