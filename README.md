# Escala de Hora Extra — V8

Versão React + Vite + Firebase com rodízio inteligente e interface dinâmica.

## Novidades

- Tema claro e escuro completo, incluindo modais, campos e menus.
- Preferência de tema salva no navegador.
- Usa automaticamente o tema do sistema no primeiro acesso.
- Transições suaves, cartões animados e feedback ao passar o mouse.
- Layout responsivo para computador, tablet e celular.
- Rodízio só avança quando a hora extra acontece.
- Sábados alternados mantêm a vez quando marcados como sem hora extra.
- Administração restrita a `andreyluccadantas@gmail.com`.

## Rodar

```bash
npm install
npm run dev
```

## Publicar no Vercel

Envie todos os arquivos para o repositório e faça um novo deploy. Depois confirme que aparece `v8.0` abaixo do título.


## Administradores dinâmicos (v8.2)

1. Publique o conteúdo de `firestore.rules` na aba **Firestore > Regras**.
2. Entre no site com um administrador principal.
3. Abra **Gerenciar administradores**.
4. Adicione o e-mail Google da pessoa. O acesso passa a valer em tempo real, sem novo deploy.

Administradores principais protegidos:
- andreyluccadantas@gmail.com
- viniciusnex43@gmail.com

Os administradores adicionados pelo painel ficam na coleção `admins` do Firestore e podem ser removidos pelo mesmo painel.
