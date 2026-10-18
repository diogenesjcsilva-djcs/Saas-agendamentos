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

## Correções adicionais aplicadas após a primeira revisão

### 7. Falha de compilação no cadastro público — corrigida estaticamente
- O token e o objeto de usuário de `POST /auth/register` referenciavam `tenantId`, embora a rota tenha definido `userTenantId`.
- Ambos agora usam `userTenantId`, coerente com o cadastro público de cliente sem vínculo a tenant.
- O cadastro valida formato de e-mail, nome não vazio/com limite e senha com no mínimo 12 caracteres; o e-mail é normalizado antes da consulta e gravação.

### 8. Atualização de serviço com verificação de proprietário incompleta — endurecida
- A consulta inicial já verificava `id` e `provider_id`; o `UPDATE` agora também exige ambos na cláusula `WHERE`.
- A rota verifica se o `UPDATE` retornou linha antes de montar a resposta.

### 9. Alteração de status de agendamento — endurecida
- `PATCH /bookings/:id` aceita apenas `pending`, `confirmed`, `completed` e `cancelled`.
- Papéis que não sejam `client` ou `provider` são explicitamente negados.
- Cliente só pode cancelar o próprio agendamento; profissional só pode alterar agendamento do próprio `providerId`.
- A rodada seguinte definiu transições explícitas: cliente pode cancelar apenas reservas `pending`/`confirmed`; profissional pode mover `pending` para `confirmed`/`cancelled` e `confirmed` para `completed`/`cancelled`. Estados terminais (`completed`/`cancelled`) não podem ser reabertos.
- O `UPDATE` repete a condição do estado anterior no SQL; se outra requisição mudar o estado entre leitura e gravação, a atualização falha com HTTP 409 em vez de sobrescrever a alteração.

### 10. Reagendamento e grade de disponibilidade — endurecidos
- Reagendamento valida que `startsAt` seja uma data interpretável, nega papéis desconhecidos e repete a autorização do proprietário na própria instrução SQL de atualização.
- Alteração de regras e exceções de disponibilidade exige `providerId` presente no token e correspondente ao alvo; remoção de exceção também nega ausência de vínculo de profissional.

### 11. Exposição desnecessária de dados públicos — reduzida
- `GET /providers` não retorna mais e-mail dos profissionais.
- `GET /slots` não seleciona nomes de clientes dos agendamentos existentes, usados apenas para calcular conflitos.

## Pontos que permanecem pendentes de validação

1. **Isolamento multi-tenant completo:** as correções cobrem rotas específicas, mas é necessário revisar todas as consultas/tabelas e relações entre `users`, `providers`, `services` e `tenants`. Não declarar isolamento completo sem essa revisão.
2. **Transições de estado:** a lista de status é validada, mas as transições permitidas (por exemplo, de `cancelled` para `completed`) ainda precisam de uma máquina de estados explícita.
3. **Reagendamento e concorrência:** a criação de agendamentos agora usa `pg_advisory_xact_lock` por profissional/dia dentro da transação, pois `FOR UPDATE` não protege quando a consulta retorna zero linhas. Ainda é necessário aplicar/validar sincronização equivalente no reagendamento, testar fuso horário e regras de intervalo e executar testes concorrentes contra PostgreSQL; a validação estática não substitui teste com banco.
4. **Validação de entrada global:** revisar limites numéricos, duração/preço negativos, limites de tamanho e validação de datas em todos os endpoints.
5. **Rate limiting em produção:** o limitador permanece em memória local; usar armazenamento compartilhado quando houver múltiplas réplicas e configurar proxy confiável corretamente.
6. **Configuração e gestão de segredo:** definir `JWT_SECRET` forte no ambiente de deployment, usar secret manager e planejar rotação. A rota de criação de tenant agora valida o segredo antes de gravar no banco.
7. **Testes automatizados:** cobrir 401 sem token, 403 para papel errado, acesso cruzado entre tenants/profissionais, segredo ausente/fraco, login social, estados inválidos, reagendamento e respostas 429.
8. **Testes de build:** executar instalação determinística de dependências, `npm run lint` e `npm run build` em CI antes do merge.
9. **Rate limit e proxy:** confirmar a configuração real de `trust proxy`; `req.ip` só é confiável se a cadeia de proxies for configurada corretamente.
10. **Documentação/arquitetura:** confirmar o comando de build e a divergência aparente entre README e manifesto de dependências.

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


## Correções adicionais — criação e atualização de agendamentos

### 12. Integridade entre serviço e profissional
- A criação pública de agendamento agora verifica que o `providerId` informado corresponde ao `providerId` proprietário do serviço selecionado.
- Sem essa verificação, era possível combinar um serviço de um profissional com o identificador de outro profissional, afetando a integridade do agendamento e as verificações de conflito.

### 13. Validação dos dados do agendamento
- A rota de criação rejeita datas inválidas, nomes vazios ou excessivamente longos, e-mails inválidos, telefones inválidos/longos e observações acima do limite.
- O e-mail do cliente é normalizado antes de gravar, alinhando o valor usado nas consultas de propriedade do cliente.
- A rota de reagendamento retorna 404 se a atualização SQL não retornar uma linha, em vez de tentar serializar um resultado inexistente.

### 14. Autorização no SQL para mudança de status
- A instrução SQL de `PATCH /bookings/:id` repete a regra de propriedade: cliente só cancela agendamento com o próprio e-mail; profissional só altera agendamento associado ao seu `providerId`.
- Isso reduz a janela de condição de corrida entre a leitura do agendamento e a atualização.

## Validação da branch após esta rodada
- Verificação estática de trechos críticos realizada por leitura do conteúdo da branch.
- O status de CI consultado apresenta uma verificação Vercel pendente; isso não equivale a build aprovado.
- Nenhum teste automatizado, teste com banco real ou execução local de lint/build foi realizado nesta rodada.
