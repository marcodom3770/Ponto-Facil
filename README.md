# ⏱️ PontoFácil Pernambucanas (Portal Nossa Gente)

> Aplicativo completo e profissional para automação de marcação de ponto, cronômetro de 59 minutos de almoço com alarme sonoro, notificações nativas para celular e painel inteligente de Banco de Horas para colaboradores Pernambucanas (LG Cloud SAAA).

---

## 🌟 Principais Funcionalidades

### 1. 🚀 Automação Direta com Portal Pernambucanas LG Cloud
- Conexão nativa HTTP via Node.js diretamente ao portal oficial: `https://pernambucanas.lgcloud.com.br/autenticacao/produtos/SAAA/principal2.aspx?c=pernambucanas`.
- Autenticação ASP.NET WebForms de alta velocidade (resolução em menos de 2 segundos) sem dependência de navegadores externos pesados.
- **Detecção e Teste Inteligente de CPF**: Testa automaticamente tanto no formato somente números (`50627526802`) quanto formatado com pontuação (`506.275.268-02`).
- **Decodificação Completa de Acentos**: Trata mensagens oficiais de alerta do portal decodificando entidades HTML (`á`, `é`, `í`, `ó`, `ú`, `ã`, `õ`, `ç`, `ê`, `ô`, etc.).
- **Modo Dry-Run (Teste de Conexão Real)**: Valida suas credenciais e tokens no servidor da Pernambucanas sem bater ponto na folha do RH.
- **Modo Simulação Local**: Permite testar todos os fluxos e alarmes instantaneamente sem acessar a rede externa.

### 2. 🥪 Alerta Pós-Ponto e Cronômetro de Almoço de 59 Minutos
- Logo após bater o ponto, exibe o alerta: **"É horário de almoço? [Sim] [Não]"**.
- Se responder **Não**: fecha o alerta normalmente.
- Se responder **Sim**: ativa o cronômetro regressivo persistente de **59 minutos**.
- **Notificação Fixa no Celular**: Mantém uma barra de status ativa nas notificações do smartphone via Service Worker PWA (`/public/sw.js`).
- **Alarme Musical ao Final**: Ao zerar os 59 minutos, dispara um alarme sonoro configurável e abre a tela de retorno: *"Deseja iniciar o app novamente e bater o ponto de volta?"*.

### 3. 📊 Painel Profissional de Banco de Horas
- Cálculo em tempo real de horas trabalhadas no dia.
- Comparação com a jornada de trabalho configurada (ex: 8h, 8h48 ou personalizada).
- **Trabalho em Dias de Folga**: Dias como Sábado e Domingo contam automaticamente como 100% de hora extra / banco de horas.
- Histórico visual com pontos identificados:
  - 🟢 **Confirmado / Oficial**: Batidas reais no portal.
  - 🟡 **Simulado / Teste**: Batidas executadas em modo de simulação.
- Possibilidade de lançar batidas manuais ou ajustar horários.

### 4. 🎨 Temas, Cores e Fundo Animado Matrix
- Fundo animado no estilo **Matrix Rain Canvas** integrado à cor do tema escolhido.
- Seletor de cores: **Amarelo Pernambucanas**, **Verde Neon**, **Vermelho Intenso**, **Azul Cobalto** e **Roxo Futurista**.
- Alternância entre Modo Escuro e Modo Claro.
- 5 presets musicais de alarme via sintetizador Web Audio API:
  - Chime Melódico
  - Beep Digital Futurista
  - Tom Suave Harmônico
  - Fanfarra Triunfal
  - Pulso Contínuo Enérgico

### 5. 🔍 Botão de Verificação de Pontos Batidos no Portal (Pessoa Física)
- Se a área de **Marcações do dia** estiver vazia no início do dia, um botão dedicado permite consultar o portal oficial.
- O app acessa `pernambucanas.lgcloud.com.br` como Pessoa Física pelo navegador, inspeciona o widget oficial *"Marcações do dia"* e extrai as batidas já realizadas (ex: 07:39, 11:38).
- As batidas encontradas são sincronizadas automaticamente na linha do tempo com o indicador verde **Oficial / Confirmado**, junto com a captura de tela oficial do portal.
- **100% Seguro**: Ele apenas consulta a folha sem clicar em "Marcar ponto".

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion.
- **Backend / Proxy**: Node.js, Express, Native Fetch HTTP Engine.
- **PWA**: Service Worker para notificações nativas no Android/iOS.
- **Áudio**: Web Audio API (sem dependência de arquivos mp3 externos).

---

## 💻 Como Rodar o Projeto

### Pré-requisitos
- Node.js 20+ instalado.
- Gerenciador de pacotes npm.

### Instalação
```bash
# 1. Instalar as dependências
npm install

# 2. Iniciar o servidor de desenvolvimento
npm run dev
```

Abra seu navegador em: `http://localhost:3000`.

---

## 📱 Instalação no Celular (PWA)

1. Abra o link do aplicativo no Google Chrome ou Safari do seu celular.
2. Toque no menu do navegador (três pontinhos ou botão de compartilhar).
3. Selecione **"Adicionar à tela inicial"** ou **"Instalar aplicativo"**.
4. Conceda permissão de notificações quando solicitado pelo aplicativo para receber alertas na barra de notificações do celular mesmo com o app minimizado.

---

## 🔒 Segurança e Privacidade

- Suas credenciais de login e senha ficam armazenadas exclusivamente no `localStorage` do seu navegador.
- Nenhuma senha é salva em banco de dados externo ou compartilhada com terceiros.
- A comunicação com o portal da Pernambucanas é direta e encriptada via HTTPS.

---

## 📄 Licença
Licença Apache 2.0. Desenvolvido para auxílio no dia a dia corporativo Pernambucanas.
