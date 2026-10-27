# Instalação e uso offline

O manifest e os ícones tornam o Aurora instalável em navegadores compatíveis. O service worker usa cache de rede em primeiro lugar para recursos locais da mesma origem e recorre à cópia armazenada apenas quando a rede falha. Requisições com query string e qualquer caminho `/api/` ficam fora do cache. O Aurora não oferece conta ou sincronização de dados pessoais; apenas a inscrição e a fase/horário necessários aos avisos Push opcionais do Pomodoro usam a API externa descrita em [pomodoro-push.md](./pomodoro-push.md).

Os caminhos do manifest e do worker são relativos à raiz publicada, inclusive quando o site está em um subdiretório. O registro funciona em HTTPS e em `localhost`; navegadores sem service worker continuam usando o app normalmente enquanto online. Depois de abrir a aplicação uma vez online, recarregue-a para que o worker assuma o controle e armazene a casca e os recursos acessados. O uso offline não sincroniza dados pessoais.

No iPhone/iPad, o Push exige iOS/iPadOS 16.4 ou posterior, origem HTTPS e o app aberto como PWA independente depois de usar **Safari → Compartilhar → Adicionar à Tela de Início**. O pedido de permissão só ocorre ao tocar em **Ativar avisos**. A entrega e o som não são garantidos pelo app; consulte o guia do Pomodoro Push para limites e implantação.

## Teste em um celular Android na rede local

Com o computador e o celular na mesma rede Wi-Fi, sirva a raiz do projeto aceitando conexões da rede:

```powershell
python -m http.server 8765 --bind 0.0.0.0
```

Consulte o IPv4 da conexão Wi-Fi do computador com `ipconfig` e abra `http://IP-DO-COMPUTADOR:8765/` no Chrome do Android. Se necessário, permita o Python no firewall do Windows para redes privadas. O computador precisa permanecer ligado e o servidor em execução.

Esse endereço HTTP da rede local não é considerado uma origem segura pelo navegador. O aplicativo funciona enquanto conectado, e os dados ficam no `localStorage` do navegador do celular, mas o service worker não é registrado e a instalação offline como PWA não fica disponível. Uma opção de adicionar à tela inicial nesse cenário pode criar apenas um atalho. `localhost` só é considerado seguro quando acessado no próprio dispositivo.

Para validar, sirva a raiz por HTTP local, abra `http://localhost:8765/`, confirme no painel Application que o manifest e o worker carregaram, visite as telas desejadas enquanto online e depois teste uma recarga offline. Verifique também que uma URL `/api/` nunca aparece no cache.
