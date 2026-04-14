# 💊 ViverBem - Backend API

O **ViverBem** é uma API RESTful desenvolvida em Node.js e Express, projetada para gerenciar lembretes de medicamentos, rastreamento de doses, contatos de emergência e identificação inteligente de medicamentos. O sistema foi desenhado com foco em acessibilidade e segurança, visando atender principalmente usuários idosos.

## 🚀 Tecnologias e Arquitetura

* **Ambiente de Execução:** Node.js
* **Framework Web:** Express.js (5.2.1)
* **Banco de Dados:** Firebase Firestore (NoSQL em tempo real)
* **Notificações:** Firebase Cloud Messaging (FCM)
* **Agendamento (Cron):** `node-cron`
* **Uploads de Arquivos:** Multer (processamento em memória, otimizado para deploy em nuvem)
* **Testes:** Jest + Supertest
* **Inteligência Artificial:** Integração planejada com OpenAI (`gpt-4o` para visão e `gpt-4o-mini` para chat) / Google Vision.
* **Segurança:** Autenticação via header `X-Device-ID` (UUID do dispositivo) e planejamento de criptografia AES-256 (LGPD).

## 📁 Estrutura do Projeto

A arquitetura segue uma separação clara de responsabilidades (Rotas, Controladores/Middlewares e Serviços):

```text
VIVERBEM-BACKEND-NODEJS/
├── src/
│   ├── middleware/
│   │   └── validateDeviceId.js    # Validador do header X-Device-ID
│   ├── routes/
│   │   ├── ai.js                  # Rotas de scan de imagens e chat
│   │   ├── alarms.js              # CRUD de lembretes
│   │   ├── doses.js               # Confirmação e histórico de doses
│   │   └── emergency.js           # Gerenciamento de contatos de emergência
│   ├── services/
│   │   ├── ai.js                  # Integração com IA (Visão/Chat)
│   │   ├── fcm.js                 # Disparo de Push Notifications
│   │   ├── firestore.js           # Abstração de acesso ao banco
│   │   └── scheduler.js           # CRON jobs para alarmes e renotificações
│   └── app.js                     # Configuração do Express (CORS, JSON, Rotas)
├── tests/                         # Testes unitários e de integração (Jest)
├── .babelrc
├── .gitignore
├── server.js                      # Entry point (Inicia o app e o scheduler)
└── package.json
```

## ⚙️ Regras de Negócio e Fluxos Críticos

O backend orquestra lógicas vitais para a segurança do paciente:

1. **Gestão de Alarmes:** É bloqueada a criação de múltiplos alarmes para o mesmo medicamento com um intervalo inferior a **1 hora**.
2. **Motor de Notificações (Scheduler):**
   * **Verificação contínua:** A cada **1 minuto**, o sistema checa alarmes ativos e dispara notificações push via FCM.
   * **Política de Reenvio:** Se uma dose não for confirmada em **15 minutos**, o sistema reenvia a notificação.
   * **Limite de Tentativas:** Máximo de **3 tentativas** de reenvio. Após isso, a dose é registrada como "não confirmada/perdida".
3. **Protocolo de Emergência:** Se o usuário permanecer **24 horas consecutivas** sem confirmar nenhuma dose, um alerta automático é disparado para o contato de emergência.
4. **Inteligência Artificial (Scan):** O processamento de imagens de medicamentos exige um grau de confiança **>= 80%**. Resultados inferiores solicitam nova captura. O histórico de scans é limitado aos últimos 15 medicamentos (FIFO) por dispositivo.

## 🔗 Endpoints da API

*Todos os endpoints (exceto `/health`) exigem o header `X-Device-ID` contendo o UUID válido do dispositivo.*

### Sistema e IA
* `GET /health` - Health check da aplicação.
* `POST /scan` - Upload de imagem da embalagem do medicamento para OCR/Identificação via IA.
* `POST /chat` - Assistente virtual de saúde.

### Alarmes e Doses
* `GET /alarms`, `POST /alarms`, `PUT /alarms/:id`, `DELETE /alarms/:id` - Gerenciamento de lembretes (horário, frequência, dosagem).
* `POST /doses` - Confirma a ingestão de uma dose ou marca como perdida (atualiza o `dose_history`).

### Emergência
* `GET /emergency-contact`, `POST /emergency-contact`, etc. - Gerenciamento de contatos de confiança.

## 🛠️ Como Executar Localmente

### Pré-requisitos
* Node.js instalado (v18+ recomendado).
* Conta no Firebase com Firestore e Cloud Messaging configurados.
* Chave de serviço do Firebase (`firebase-adminsdk.json`).

### Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/viverbem-backend-nodejs.git
   cd viverbem-backend-nodejs
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente crie um arquivo `.env` na raiz do projeto:
   ```env
   PORT=3000
   FIREBASE_PROJECT_ID=seu_project_id
   FIREBASE_CLIENT_EMAIL=seu_client_email
   FIREBASE_PRIVATE_KEY="sua_private_key"
   OPENAI_API_KEY=sua_chave_aqui
   ```

4. Inicie o servidor:
   ```bash
   npm run start
   # Ou para desenvolvimento: npm run dev
   ```

## 🧪 Executando Testes

O projeto utiliza Jest e Supertest para garantir a qualidade do código.
```bash
npm run test
```

## 📈 Metas de Desempenho
* **Tempo de Resposta:** < 5 segundos para fluxos completos de IA.
* **Escalabilidade:** Arquitetura pronta para até 10.000 usuários simultâneos.
* **Disponibilidade:** Alvo de 99.5% de uptime com deploy conteinerizado.


## 🧑‍💻 Padrões de Contribuição
* **Branching:** Criar branches baseadas em funcionalidades (`feature/nome-da-feature`, `fix/descricao-do-bug`).
* **Commits:** Utilizar o padrão de Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
