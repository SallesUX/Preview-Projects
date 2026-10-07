# Dule.app

App para acompanhar o trabalho de parto: cronômetro de contrações, janela da fase atual com recomendações, chat de notas (texto e áudio), escalas de dor (0–10) e humor (emojis) e relatório para mostrar à equipe. Funciona offline e guarda tudo só no celular.

## Rodar no computador
```bash
npm install
npm run dev
```
Abra o endereço "Network" que aparece (ex.: `http://192.168.0.10:5173`) no celular, na mesma rede Wi‑Fi.

> Microfone, instalação na tela inicial e modo offline exigem **HTTPS** (ou `localhost`). Para usar de verdade, publique (abaixo).

## Publicar (grátis)
```bash
npm run build
npx vercel deploy dist --prod     # ou: npx netlify deploy --dir=dist --prod
```
No celular, abra o link e use **Compartilhar → Adicionar à Tela de Início** (iPhone) ou **Instalar app** (Android).

## Testes
```bash
npm test
```

## Antes do dia
1. Em Configurações, crie um parto **"Ensaio"** e teste tudo (inclusive gravar áudio e compartilhar o relatório).
2. Confirme com a obstetra o critério do alerta (5‑1‑1 ou outro) e ajuste.
3. Volte para o parto real e exporte um backup de vez em quando.

O app não substitui a orientação da equipe médica.
