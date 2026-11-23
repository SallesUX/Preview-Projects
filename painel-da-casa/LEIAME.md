# Painel da Casa

Painel estilo "Echo Show" feito em HTML/JS puro (sem frameworks), pensado para tablet antigo na horizontal.
Funciona também no computador e no celular.

## O que tem
- **Relógio e saudação**, com quantas tarefas faltam no dia.
- **Rotina de hoje**: tarefas que se repetem por dia da semana, com horário. Toque no círculo para marcar como feita; a tarefa do horário atual fica destacada. Toque em ✎ para editar.
- **Agenda**: compromissos dos próximos 7 dias (criados no painel e/ou vindos do Google Agenda).
- **Listas**: Compras, Lembretes e quantas mais quiser.
- **Standby**: depois de alguns minutos sem toque (configurável), passa fotos com relógio, calendário do mês e próximos compromissos. Toque para voltar.
- **Voz** (botão 🎤, funciona no Google Chrome):
  - "adicionar leite e ovos na lista de compras"
  - "nova tarefa ligar para o banco"
  - "quais são minhas tarefas" / "o que tenho na agenda amanhã"
  - "marcar academia como feito" / "terminei regar as plantas"
  - "o que tem na lista de compras" / "limpar comprados"
  - "modo standby" / "que horas são"

Os dados ficam salvos no próprio aparelho (localStorage). Use **⚙️ > Exportar backup** de vez em quando.

## Como testar
A voz e o modo "app" exigem HTTPS (ou `localhost`). Duas formas:
1. **Computador**: dentro desta pasta rode `python3 -m http.server 8080` e abra `http://localhost:8080`.
2. **Tablet/celular**: publicar a pasta num endereço HTTPS gratuito (GitHub Pages, Netlify ou Cloudflare Pages).
   Depois, no Chrome do tablet: menu ⋮ > "Adicionar à tela inicial" — abre em tela cheia, sem barra.

Dica: `?standby` no fim do endereço abre direto no modo standby.

## Google Agenda (para você e sua esposa adicionarem pelo celular)
Caminho mais simples, sem servidor e sem chave de API: um pequeno script no **seu** Google que lê as agendas e entrega para o painel.

1. Sua esposa compartilha a agenda dela com você (Google Agenda > Configurações da agenda dela > "Compartilhar com pessoas específicas" > seu e-mail > "Ver todos os detalhes"). Ou criem juntos uma agenda "Família" compartilhada.
2. Acesse https://script.google.com > **Novo projeto**, apague o conteúdo e cole o arquivo `apps-script.gs`.
3. Troque `EMAIL_DA_ESPOSA@gmail.com` pelo e-mail dela (ou ID da agenda Família). Opcional: coloque uma palavra em `CHAVE`.
4. **Implantar > Nova implantação > App da Web**: "Executar como: Eu", "Quem pode acessar: Qualquer pessoa". Autorize o acesso à agenda.
5. Copie a URL que termina em `/exec` e cole no painel em **⚙️ > Google Agenda**. Se usou CHAVE, acrescente `?k=SUA_CHAVE` ao final.

O painel atualiza a cada 10 minutos. Vocês continuam criando compromissos normalmente no app Google Agenda do celular.

**Sobre segurança**: a URL é "secreta" (quem tiver o link consegue ler os títulos dos eventos). A `CHAVE` reduz esse risco. O script só lê, não altera nada.

## Próximos passos possíveis
- Sincronizar rotina e listas entre os celulares (hoje ficam só no painel).
- Previsão do tempo no topo.
- Palavra de ativação ("Painel, …") sem precisar tocar no microfone.
