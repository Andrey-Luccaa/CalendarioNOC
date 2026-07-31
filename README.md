# Escala de Hora Extra — V3

## O que foi adicionado

- Segunda a sexta: rodízio normal com uma pessoa por dia.
- Sábados alternados: Grupo A em um sábado e Grupo B no sábado seguinte.
- Configuração padrão: Grupo A = Andrey + Vinicius; Grupo B = Jonatas.
- Opção "Sem hora extra" em qualquer data.
- Equipe e cores personalizáveis.
- Site público para visualização.
- Apenas o administrador autenticado com Google pode editar.

## Configurar o Firebase

1. Crie um projeto no Firebase Console.
2. Em **Authentication > Sign-in method**, ative o provedor **Google**.
3. Em **Authentication > Settings > Authorized domains**, adicione o domínio do seu projeto Vercel.
4. Crie um **Realtime Database**.
5. Em **Configurações do projeto > Seus apps**, crie um app Web e copie as credenciais.
6. Cole as credenciais em `firebase-config.js`.
7. Troque `SEU_EMAIL@gmail.com` pelo seu e-mail Google em:
   - `firebase-config.js`
   - `database.rules.json`
8. No Realtime Database, abra a aba **Rules** e cole o conteúdo de `database.rules.json`.
9. Publique novamente no Vercel.

## Segurança

A interface esconde os botões de edição para visitantes, mas a proteção real está nas regras do Realtime Database. Mesmo que alguém tente alterar o JavaScript pelo navegador, o Firebase recusará qualquer gravação que não venha do e-mail administrativo configurado.

## Publicar no Vercel

Envie o conteúdo desta pasta, garantindo que `index.html` esteja na raiz do projeto. Depois da publicação, faça `Ctrl + F5` para limpar o cache.
