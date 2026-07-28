param([int]$Porta = 5500)

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Porta/")

try {
    $listener.Start()
    Write-Host "Site aberto em http://localhost:$Porta" -ForegroundColor Cyan
    Write-Host "Mantenha esta janela aberta. Pressione Ctrl+C para encerrar."

    $tipos = @{
        '.html' = 'text/html; charset=utf-8'
        '.css'  = 'text/css; charset=utf-8'
        '.js'   = 'application/javascript; charset=utf-8'
        '.json' = 'application/json; charset=utf-8'
        '.png'  = 'image/png'
        '.jpg'  = 'image/jpeg'
        '.jpeg' = 'image/jpeg'
        '.svg'  = 'image/svg+xml'
        '.ico'  = 'image/x-icon'
    }

    while ($listener.IsListening) {
        $contexto = $listener.GetContext()
        $caminhoUrl = [Uri]::UnescapeDataString($contexto.Request.Url.AbsolutePath.TrimStart('/'))
        if ([string]::IsNullOrWhiteSpace($caminhoUrl)) { $caminhoUrl = 'index.html' }

        $arquivo = Join-Path $raiz $caminhoUrl
        $arquivoCompleto = [System.IO.Path]::GetFullPath($arquivo)
        $raizCompleta = [System.IO.Path]::GetFullPath($raiz)

        if (-not $arquivoCompleto.StartsWith($raizCompleta) -or -not (Test-Path $arquivoCompleto -PathType Leaf)) {
            $contexto.Response.StatusCode = 404
            $bytes = [Text.Encoding]::UTF8.GetBytes('Arquivo não encontrado')
        } else {
            $extensao = [System.IO.Path]::GetExtension($arquivoCompleto).ToLowerInvariant()
            $contexto.Response.ContentType = if ($tipos.ContainsKey($extensao)) { $tipos[$extensao] } else { 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($arquivoCompleto)
        }

        $contexto.Response.ContentLength64 = $bytes.Length
        $contexto.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $contexto.Response.OutputStream.Close()
    }
}
finally {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
}
