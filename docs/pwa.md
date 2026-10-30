# Instalação e uso offline

O manifest e os ícones tornam o Aurora instalável em navegadores compatíveis. O service worker usa cache de rede em primeiro lugar para recursos locais da mesma origem e recorre à cópia armazenada apenas quando a rede falha. Requisições com query string e qualquer caminho `/api/` ficam fora do cache. A landing e a demonstração fictícia funcionam sem conta; acessar e sincronizar dados pessoais exige conexão com Supabase e uma conta autenticada. O service worker não armazena respostas da API nem dados pessoais. Os avisos Push opcionais do Pomodoro e dos lembretes de Hábitos usam a API externa descrita em [pomodoro-push.md](./pomodoro-push.md).

O manifest é publicado na raiz do app; os HTML usam `%BASE_URL%` para que o Vite preserve esse caminho e o ajuste caso a publicação use um subdiretório. Isso é necessário porque `start_url` e `scope` são relativos ao próprio arquivo do manifest. O worker também é publicado na raiz. O registro funciona em HTTPS e em `localhost`; navegadores sem service worker continuam usando o app normalmente enquanto online. Depois de abrir a aplicação uma vez online, recarregue-a para que o worker assuma o controle e armazene a casca e os recursos acessados. O uso offline não sincroniza dados pessoais.

No iPhone/iPad, abra o site no Safari e use **Compartilhar → Adicionar à Tela de Início**. As entradas da aplicação declaram o ícone Apple e os metadados para abrir em modo independente. Se uma versão instalada anteriormente não abrir, remova somente o atalho antigo da tela inicial, abra o site novamente no Safari e adicione-o outra vez; os dados da conta não são apagados ao remover o atalho. A instalação e os recursos offline exigem conexão HTTPS.

No iPhone/iPad, o Push exige iOS/iPadOS 16.4 ou posterior e o app aberto como PWA independente. O pedido de permissão só ocorre ao tocar em **Ativar avisos** em Pomodoro ou Hábitos. A entrega e o som não são garantidos pelo app; consulte o guia Push para limites e implantação.

## Teste em um celular Android na rede local

Com o computador e o celular na mesma rede Wi-Fi, inicie o Vite aceitando conexões da rede:

```powershell
npm run dev -- --host 0.0.0.0 --port 8765
```

Consulte o IPv4 da conexão Wi-Fi do computador com `ipconfig` e abra `http://IP-DO-COMPUTADOR:8765/` no Chrome do Android. Se necessário, permita o Node.js no firewall do Windows para redes privadas. O computador precisa permanecer ligado e o servidor em execução. Um servidor HTTP estático simples não processa os módulos npm do código-fonte do app.

Esse endereço HTTP da rede local não é considerado uma origem segura pelo navegador. A landing e a demonstração funcionam enquanto acessíveis; para entrar na conta, também é necessária a configuração Supabase e uma conexão com o serviço. O service worker não é registrado nesse endereço e a instalação offline como PWA não fica disponível. Uma opção de adicionar à tela inicial nesse cenário pode criar apenas um atalho. `localhost` só é considerado seguro quando acessado no próprio dispositivo.

Para validar a instalação, execute `npm run build` e confirme que os HTML gerados apontam para `manifest.webmanifest` na raiz publicada (não para uma cópia em `assets/`). Use uma origem HTTPS ou `localhost`, abra a aplicação, confirme no painel Application que o manifest e o worker carregaram, visite os recursos enquanto online e depois teste uma recarga offline. Verifique também que uma URL `/api/` nunca aparece no cache.
