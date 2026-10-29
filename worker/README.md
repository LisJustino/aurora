# Segredos do Worker de Push

`VAPID_SUBJECT` não deve ser declarado em `wrangler.toml` nem enviado ao Git. Configure-o como secret do Worker nos ambientes de produção e desenvolvimento pelo painel Cloudflare, em **Workers & Pages → aurora-pomodoro-push → Settings → Variables and Secrets → Add**. Use o nome `VAPID_SUBJECT` e um contato operacional autorizado no formato `mailto:...`; marque-o como **Secret**. O secret precisa existir em cada ambiente antes de enviar notificações.

Para desenvolvimento local, use `worker/.dev.vars`, que já é ignorado pelo Git, mantendo o mesmo nome de variável. Não registre o valor em arquivos rastreados, comandos salvos, logs ou testes.
