# Escala de Hora Extra — Site v2

## Executar

Abra `index.html` diretamente ou publique a pasta no Vercel/Netlify/GitHub Pages.
O site funciona imediatamente no modo local, sem Firebase.

## Sincronizar entre máquinas

1. Crie um projeto no Firebase.
2. Abra **Realtime Database** e crie o banco.
3. Durante os testes, use regras que permitam leitura e gravação para a equipe. Depois, proteja o banco com autenticação.
4. Copie as credenciais do aplicativo Web para `firebase-config.js`.
5. Informe principalmente `apiKey`, `databaseURL`, `projectId`, `authDomain` e `appId`.
6. Publique novamente o site.

Exemplo de regras apenas para teste:

```json
{
  "rules": {
    "escala": {
      "$workspace": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

> Essas regras deixam os dados acessíveis a quem conhecer o endereço do banco. Para uso permanente, configure Firebase Authentication.

## Recursos

- Calendário mensal.
- Rodízio automático em dias úteis.
- Edição individual por data.
- Opção “Sem hora extra”.
- Equipe personalizável.
- Cor individual por integrante.
- Histórico de alterações.
- Tema claro e escuro.
- Armazenamento local com sincronização opcional via Firebase.


## Correção para abrir direto
Esta versão não usa scripts do tipo module. Portanto, pode ser aberta dando dois cliques no `index.html`. Para uma experiência mais próxima da publicação real, também é possível usar a extensão Live Server do VS Code ou publicar no Vercel.
