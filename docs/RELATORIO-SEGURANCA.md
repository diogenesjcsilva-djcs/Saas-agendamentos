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


### 15. Privacidade e escopo de exceções de disponibilidade
- `GET /exceptions` exige `providerId` explícito e retorna apenas as exceções desse profissional; não lista mais exceções de todos os profissionais. A leitura permanece pública porque a página de agendamento precisa consultar bloqueios de agenda, mas o resultado é limitado a um profissional por requisição.
- `GET /slots` não deve revelar nomes de clientes em mensagens de conflito. As mensagens foram generalizadas para informar apenas o motivo de indisponibilidade, sem PII.
- A proteção é validada estaticamente; ainda é necessário testar a interface de agendamento e confirmar se a exposição das datas bloqueadas por profissional corresponde à política de privacidade desejada.

### 16. Validação do perfil e alteração de senha
- A alteração de senha no perfil agora exige no mínimo 12 caracteres, alinhando a regra com o cadastro público.
- Os campos opcionais de nome/e-mail são validados antes de aplicar operações de normalização; a identificação do usuário usa o claim validado `user.userId`.


### 17. Reagendamento transacional e concorrência
- O endpoint de reagendamento agora usa uma única conexão PostgreSQL e uma transação para ler, autorizar, verificar conflitos e atualizar a reserva.
- Usa bloqueio transacional `pg_advisory_xact_lock` por profissional, compartilhado entre criação e reagendamento. O bloqueio por profissional evita corridas também quando a duração ou o buffer atravessam a meia-noite; a criação consulta reservas do dia UTC adjacente e usa limites de dia UTC consistentes.
- A verificação considera reservas em dias UTC adjacentes para não ignorar conflitos de buffer próximos à meia-noite e impede reagendar estados concluídos/cancelados.
- O `UPDATE` confirma o estado anterior e a propriedade no SQL; alterações concorrentes retornam HTTP 409.
- Ainda é necessário executar testes de concorrência com PostgreSQL e validar as regras de fuso horário usadas pela interface; o bloqueio por dia pressupõe que os horários são interpretados em UTC.

### 18. Limites de duração e intervalo dos serviços
- A criação e o reagendamento rejeitam duração não positiva, duração superior a 24 horas, buffer negativo ou buffer superior a 24 horas.
- Esses limites tornam a validação de conflitos previsível e evitam que valores inesperados no banco ampliem indefinidamente o intervalo a verificar. Ainda é necessário confirmar que os limites correspondem às regras comerciais do produto.

### 19. Isolamento de catálogo por profissional e estabelecimento
- A consulta pública de serviços agora aplica simultaneamente os filtros `providerId` e `tenantId` quando ambos são informados. Antes, o ramo de `providerId` ignorava `tenantId`, podendo retornar serviços de um profissional fora do estabelecimento solicitado.
- Os filtros são validados como strings não vazias e a consulta faz o vínculo explícito entre serviços e profissionais.
- A criação e edição de serviços validam nome, descrição, duração, buffer e preço; não aceitam duração fora de 1–1440 minutos, buffer fora de 0–1440 minutos ou preço negativo. O uso de fallback numérico que transformava valores inválidos em zero foi removido.
### 20. Cadastro de estabelecimento
- O cadastro valida tipos e limites dos campos de nome, descrição e slug, limita a paleta de tema a valores conhecidos e exige senha de 12 a 128 caracteres.
- IDs de tenant, profissional e usuário passaram a usar UUID aleatório em vez de `Date.now()`, reduzindo colisões em cadastros concorrentes.
- Ainda é necessário testar restrições únicas no banco para slug/e-mail sob concorrência; a checagem prévia na aplicação não substitui uma constraint única.

### 21. Ordem dos bloqueios no reagendamento — corrigida estaticamente
- A revisão identificou risco de deadlock: o reagendamento bloqueava primeiro a linha do agendamento (`FOR UPDATE`) e depois o bloqueio consultivo do profissional, enquanto a criação adquire o bloqueio consultivo antes de consultar/bloquear reservas.
- O fluxo foi reorganizado para consultar inicialmente apenas o profissional sem bloquear a linha, adquirir o mesmo `pg_advisory_xact_lock` usado pela criação e só então reler o agendamento com `FOR UPDATE`.
- O fluxo revalida que o profissional associado não mudou antes de continuar. O bloqueio consultivo permanece ativo até o fim da transação.
- **Limite da validação:** a correção foi revisada estaticamente; ainda não foi reproduzida nem validada com testes concorrentes reais em PostgreSQL. Todos os caminhos que escrevem agendamentos devem respeitar a mesma ordem de bloqueios para eliminar esse tipo de deadlock.

### 22. Credenciais de demonstração fixas na migração — removidas
- A migração gerava um hash para a senha fixa `12345678` e fazia `UPSERT` atualizando `password_hash` dos usuários de demonstração. Executar a migração novamente podia redefinir credenciais existentes para uma senha previsível.
- O seed desses usuários agora fica desativado por padrão. Só é executado com `SEED_DEMO_USERS=true` e `SEED_DEMO_PASSWORD` configurada com 12–128 caracteres; o hash usa custo bcrypt 12.
- O conflito por ID agora usa `ON CONFLICT (id) DO NOTHING`, impedindo que uma migração redefina a senha de uma conta já existente.
- **Atenção:** se o seed de demonstração for ativado, use uma senha temporária forte e exclusiva em ambiente não produtivo. Não habilite essas contas em produção.

### 23. Estado da verificação Vercel após as últimas alterações
- Na consulta ao commit `acbc84d9124f2fb75be8bbf95c4ce6463d3293c7`, o status reportado pelo GitHub para `Vercel` era `failure`; não foram retornados GitHub Actions workflow runs para esse commit.
- O status disponível não contém a causa detalhada da falha. Portanto, não atribuir a falha a TypeScript, build, variáveis de ambiente ou deploy sem consultar os logs do deployment no Vercel.
- A PR continua aberta como Draft e não foi mesclada. O status de falha precisa ser investigado antes de qualquer merge.

### 24. Migração de banco: tabela alterada antes da criação — corrigido estaticamente
- `src/scripts/migrate.ts` tentava executar `ALTER TABLE bookings ...` antes do `CREATE TABLE IF NOT EXISTS bookings`. Em banco vazio, a migração podia falhar antes de chegar à criação da tabela.
- As colunas adicionais `client_address` e `service_location_type` agora são adicionadas depois da criação da tabela, tornando a ordem coerente para banco novo e existente.

### 25. Seeds da migração sobrescreviam dados persistidos — mitigado
- Os seeds de tenant, categoria, profissional, serviço, regra/exceção de disponibilidade e agendamento usavam `ON CONFLICT (id) DO UPDATE`, podendo sobrescrever alterações feitas no banco ao executar novamente a migração.
- Os sete caminhos de seed agora usam `ON CONFLICT (id) DO NOTHING`, evitando atualizar silenciosamente registros existentes. Conflitos com outras constraints únicas ainda podem fazer a transação falhar; isso é preferível a sobrescrever dados sem intenção, mas deve ser coberto por testes de migração.
- **Validação pendente:** não executei a migração em PostgreSQL vazio nem em cópia de banco existente. Faça backup antes de executar em qualquer ambiente com dados importantes.

### 26. Integridade do arquivo de rotas e janela de conflitos — corrigidos na revisão
- A comparação da PR revelou que `src/lib/api-routes.ts` estava truncado para 207 linhas, embora a versão íntegra tivesse cerca de 1.456 linhas. Isso removia grande parte dos endpoints e tornava o arquivo inválido/incompleto para a aplicação.
- O arquivo foi restaurado a partir da versão completa da própria branch que continha as correções anteriores, preservando os endpoints e controles de segurança já implementados.
- As consultas de criação e reagendamento passaram a considerar reservas iniciadas até dois dias antes/depois do dia UTC consultado. Como duração e buffer podem chegar a 24 horas cada, a janela de um dia podia excluir reservas relevantes em casos extremos próximos à meia-noite.
- **Validação pendente:** confirme o diff da PR e execute lint, TypeScript/build e testes de integração. Não executei build nem testes PostgreSQL nesta sessão; a restauração foi verificada por conteúdo/contagem de linhas, não por execução.

### 27. Sintaxe SQL dos seeds — corrigida estaticamente
- Uma nova inspeção completa de `src/scripts/migrate.ts` encontrou que sete instruções de seed combinavam `ON CONFLICT (id) DO NOTHING` com atribuições `coluna = EXCLUDED.coluna` remanescentes. Essa combinação é SQL inválida e faria a migração falhar quando chegasse a esses inserts.
- Removi as atribuições residuais e mantive apenas `ON CONFLICT (id) DO NOTHING` nos oito caminhos de seed (incluindo usuários de demonstração).
- Também movi os `ALTER TABLE bookings ...` para fora do loop de tenants, logo após a criação da tabela. Antes, as colunas adicionais só seriam garantidas se o arquivo de seed existisse e eram tentadas repetidamente para cada tenant.
- **Validação pendente:** verifiquei o texto e a ordem das instruções, mas não executei o script contra PostgreSQL. A execução real ainda é necessária para confirmar compatibilidade com a versão e o estado do banco.

### 28. Disponibilidade: reservas cruzando a meia-noite — corrigido estaticamente
- A consulta de `GET /slots` filtrava reservas com `starts_at::date = $2::date` e depois comparava somente a hora (`HH:mm`). Isso podia ignorar reservas iniciadas no dia anterior que ainda ocupassem parte do dia solicitado, além de introduzir dependência do fuso horário da sessão PostgreSQL.
- A consulta agora valida o formato `YYYY-MM-DD`, constrói limites explícitos UTC e busca reservas em uma janela ampliada; o cálculo de conflito usa timestamps completos em milissegundos, incluindo duração e buffers, em vez de comparar apenas o relógio.
- Os horários devolvidos são normalizados como ISO UTC.
- **Atenção:** é necessário validar com testes de integração se o fuso horário de negócio esperado pela interface é UTC ou local do profissional. A mudança elimina comparação apenas por hora, mas não substitui uma política de fuso horário definida e testada ponta a ponta.

## 29. Validação de data na consulta de horários

**Arquivo:** `src/lib/api-routes.ts`, rota `GET /slots`.

**Achado:** a expressão regular que validava `YYYY-MM-DD` estava duplamente escapada no código-fonte, impedindo a validação normal de datas; além disso, a validação acontecia depois de consultas ao banco e a determinação do dia da semana dependia do fuso horário local do processo.

**Correção aplicada:** a rota agora valida `serviceId` e o formato/validade real da data antes de consultar o banco, ancora o dia em UTC e usa `getUTCDay()` para selecionar o dia da semana de forma determinística. A comparação round-trip rejeita datas inexistentes, como `2026-02-30`.

**Limitação:** isso torna o cálculo consistente em UTC, mas não define o fuso horário comercial de cada profissional. A disponibilidade ponta a ponta ainda precisa ser testada com o fuso horário esperado pelo produto e com agendamentos próximos à meia-noite.

**Validação executada nesta etapa:** inspeção estática do trecho atualizado e confirmação de que não há status checks nem execuções de GitHub Actions reportadas para o commit consultado. Lint, build e testes com PostgreSQL continuam pendentes; ausência de checks não significa aprovação.
