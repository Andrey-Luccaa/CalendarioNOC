# Escala de Hora Extra V5

Aplicação React + Vite + Firebase Authentication + Cloud Firestore.

## 1. Defina o administrador

Edite `src/firebase.js`:

```js
export const ADMIN_EMAIL = 'seu-email@gmail.com';
```

Edite também `firestore.rules` usando exatamente o mesmo e-mail.

## 2. Ative o Firebase

No console do projeto `escala-hora-extra`:

1. Authentication > Método de login > Google > Ativar.
2. Authentication > Configurações > Domínios autorizados > adicione seu domínio `.vercel.app`.
3. Firestore Database > Criar banco de dados > modo produção.
4. Firestore Database > Regras > cole o conteúdo de `firestore.rules` e publique.

## 3. Executar

```bash
npm install
npm run dev
```

## 4. Publicar no Vercel

Envie esta pasta para o GitHub e importe o repositório no Vercel, ou execute:

```bash
npm install
npm run build
npx vercel
```

O Vercel detecta Vite automaticamente. Não publique apenas o `index.html`: envie o projeto completo.

## Primeiro acesso

Ao abrir, o documento `escala/principal` pode ainda não existir. Entre com o e-mail administrador e faça a primeira alteração; o documento será criado automaticamente.

## Segurança

A interface esconde os controles para visitantes, mas a proteção real está nas regras do Firestore. Somente o e-mail definido nas regras consegue gravar no banco.


## Regra v5
O rodízio só avança quando a hora extra é realizada. Dias marcados como “Sem hora extra” preservam a vez para o próximo dia útil. A mesma regra vale para os grupos de sábado.
