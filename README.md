# Família Barroso — Calendário Familiar A3

Protótipo funcional com:

- Templates de calendário em proporção A3 horizontal.
- Template inspirado na imagem enviada: azul, branco e dourado.
- Feriados nacionais e datas de celebração nacional de Angola carregados como eventos padrão.
- Aniversariantes com nome, data e parentesco.
- Encontros familiares, comemorações e memórias.
- QR Code exclusivo por calendário.
- URL pública por calendário.
- Visitante do QR: visualização.
- Pedido de acesso de integrante por OTP.
- Aprovação/rejeição pelo administrador.
- Membros aprovados podem adicionar pessoas, datas e felicitações.
- Felicitações ficam guardadas no perfil/linha do calendário.
- PDF A3 horizontal pelo navegador.
- Registo de notificações no servidor.
- Web Push opcional.
- Email OTP/notificações opcional via SMTP.
- SQLite para persistência.

## Instalação

Requer Node.js 20+.

```bash
npm install
cp .env.example .env
npm start
```

Abra:

http://localhost:3000

## OTP

Sem SMTP configurado, o OTP aparece no terminal onde o servidor está rodando.

Para envio real, configure no `.env`:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Familia Barroso <no-reply@seudominio.com>"
```

## Web Push

Para notificações push reais, gere chaves VAPID e coloque:

```env
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@seudominio.com
```

O servidor já possui o agendamento diário e cria notificações para:

1. primeiro dia do mês quando há datas no mês;
2. sete dias antes;
3. um dia antes;
4. no dia da data.

## PDF A3

O botão "Baixar PDF A3" usa jsPDF + html2canvas e cria:

- 420 mm × 297 mm
- orientação horizontal (landscape)

Também existe CSS `@page` para impressão física A3.

## Segurança

O visitante que chega pelo QR não recebe sessão de membro. O acesso público é somente leitura.

O fluxo de membro é:

1. QR / link público;
2. pedir acesso;
3. receber OTP;
4. confirmar OTP;
5. pedido fica `pending`;
6. administrador aprova;
7. sessão passa a ter acesso de membro.

## Feriados e datas padrão

A base inicial segue a legislação e páginas oficiais de Angola disponíveis no momento da implementação. Tolerâncias de ponto, pontes e alterações anuais devem ser atualizadas conforme o comunicado oficial correspondente ao ano.

## Próximos passos para produção

- domínio HTTPS;
- SMTP ou serviço transacional;
- Web Push/VAPID;
- backup automático do SQLite ou PostgreSQL;
- armazenamento de fotos;
- edição/exclusão de perfis;
- recuperação de senha;
- rate limiting;
- logs/auditoria;
- painel administrativo completo;
- geração PDF server-side para garantir impressão idêntica;
- política de privacidade e termos de uso.
