# Escala de Hora Extra — execução local

## Abrir corretamente no Windows

1. Extraia todo o ZIP.
2. Entre na pasta `escala-hora-extra-v2-localhost`.
3. Clique duas vezes em `iniciar-site.bat`.
4. O navegador abrirá em `http://localhost:5500`.
5. Mantenha a janela preta/PowerShell aberta enquanto estiver usando o site.

Não abra `index.html` diretamente. Endereços `file:///` têm restrições de segurança e podem impedir o carregamento dos scripts e da sincronização.

## Publicar

Também é possível enviar esta pasta para Vercel, Netlify ou GitHub Pages. Nesse caso, o site funcionará por HTTPS e o arquivo `iniciar-site.bat` não será necessário.
