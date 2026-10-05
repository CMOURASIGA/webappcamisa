import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SandboxEvent =
  | "PRE_REQUEST_CREATED"
  | "PAYMENT_INFORMED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_NOT_FOUND"
  | "CANCELLATION_REQUESTED"
  | "PRE_REQUEST_CANCELLED"
  | "PRE_REQUEST_EXPIRED"
  | "REFUND_COMPLETED";

type SandboxPayload = {
  event: SandboxEvent;
  to: string;
  protocol: string;
  officialCode?: string | null;
  requesterName: string;
  beneficiaryName: string;
  totalAmount: number;
  expiresAt?: string | null;
  paymentDate?: string | null;
  cancellationReason?: string | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function base64Utf8(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function encodeHeaderUtf8(input: string) {
  return `=?UTF-8?B?${base64Utf8(input)}?=`;
}

function base64UrlEncode(input: string) {
  return base64Utf8(input).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function getGoogleAccessToken() {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Credenciais OAuth do Gmail não configuradas.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(`Falha ao renovar token do Gmail: ${payload.error_description || payload.error || response.status}`);
  }

  return payload.access_token as string;
}

async function sendGmail(params: { to: string; subject: string; html: string; text: string }) {
  const accessToken = await getGoogleAccessToken();
  const fromEmail = Deno.env.get("GMAIL_FROM");
  const fromName = Deno.env.get("GMAIL_FROM_NAME") || "EAC Porciúncula de Santana";

  if (!fromEmail) throw new Error("GMAIL_FROM não configurado.");

  const boundary = "eac-camisas-sandbox-boundary";
  const mime = [
    `From: ${encodeHeaderUtf8(fromName)} <${fromEmail}>`,
    `To: ${params.to}`,
    `Subject: ${encodeHeaderUtf8(params.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    params.text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    params.html,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: base64UrlEncode(mime) }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Falha no envio pelo Gmail: ${payload?.error?.message || response.status}`);
  }

  return payload;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function eventCopy(payload: SandboxPayload) {
  const amount = formatMoney(Number(payload.totalAmount || 0));
  const protocol = payload.protocol;
  const official = payload.officialCode ? ` Pedido oficial: ${payload.officialCode}.` : "";

  const copies: Record<SandboxEvent, { subject: string; title: string; body: string }> = {
    PRE_REQUEST_CREATED: {
      subject: `Pré-solicitação recebida - ${protocol}`,
      title: "Pré-solicitação recebida",
      body: `Recebemos sua pré-solicitação ${protocol}, no valor de ${amount}. Ela ainda não é um pedido confirmado e não reserva camisa. Informe o pagamento até ${formatDate(payload.expiresAt)}. Se o pagamento não for informado dentro do prazo, a pré-solicitação poderá expirar automaticamente.`,
    },
    PAYMENT_INFORMED: {
      subject: `Pagamento informado - ${protocol}`,
      title: "Pagamento enviado para validação",
      body: `Você informou o pagamento da pré-solicitação ${protocol}. O Financeiro ainda precisa localizar e confirmar o PIX. Até essa confirmação, a compra não está concluída.`,
    },
    PAYMENT_CONFIRMED: {
      subject: `Pedido confirmado - ${payload.officialCode || protocol}`,
      title: "Pagamento confirmado",
      body: `O Financeiro confirmou o PIX da pré-solicitação ${protocol}.${official} A partir deste momento a solicitação passa a fazer parte do fluxo operacional de camisas.`,
    },
    PAYMENT_NOT_FOUND: {
      subject: `PIX não localizado - ${protocol}`,
      title: "Pagamento ainda não localizado",
      body: `O Financeiro não conseguiu localizar o PIX informado para ${protocol}. A pré-solicitação permanece registrada para regularização. Confira os dados do pagamento antes de um novo contato com a equipe.`,
    },
    CANCELLATION_REQUESTED: {
      subject: `Cancelamento recebido - ${protocol}`,
      title: "Solicitação de cancelamento recebida",
      body: `Recebemos o pedido de cancelamento de ${protocol}. Como existe informação financeira associada, o Financeiro verificará se houve entrada do PIX e, se necessário, fará o tratamento de estorno.`,
    },
    PRE_REQUEST_CANCELLED: {
      subject: `Pré-solicitação cancelada - ${protocol}`,
      title: "Pré-solicitação cancelada",
      body: `A pré-solicitação ${protocol} foi cancelada. Nenhum pedido oficial foi confirmado e nenhuma camisa ficou reservada.`,
    },
    PRE_REQUEST_EXPIRED: {
      subject: `Pré-solicitação expirada - ${protocol}`,
      title: "Prazo encerrado",
      body: `A pré-solicitação ${protocol} expirou porque o pagamento não foi informado dentro do prazo. Nenhum pedido oficial foi confirmado e nenhuma camisa ficou reservada. Para comprar depois, será necessário criar uma nova pré-solicitação.`,
    },
    REFUND_COMPLETED: {
      subject: `Estorno registrado - ${protocol}`,
      title: "Estorno registrado",
      body: `O Financeiro registrou a conclusão do estorno relacionado a ${protocol}. A solicitação está encerrada.`,
    },
  };

  return copies[payload.event];
}

function allowedRecipient(to: string) {
  const allowed = (Deno.env.get("SANDBOX_EMAIL_ALLOWED_RECIPIENTS") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!allowed.length) {
    throw new Error("SANDBOX_EMAIL_ALLOWED_RECIPIENTS não configurado.");
  }

  return allowed.includes(to.trim().toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405, headers: corsHeaders });

  try {
    const payload = await req.json() as SandboxPayload;

    if (!payload.event || !payload.to || !payload.protocol || !payload.requesterName || !payload.beneficiaryName) {
      return new Response(JSON.stringify({ success: false, error: "Payload incompleto." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!allowedRecipient(payload.to)) {
      return new Response(JSON.stringify({
        success: false,
        error: "Destinatário não autorizado para o sandbox.",
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const copy = eventCopy(payload);
    if (!copy) {
      return new Response(JSON.stringify({ success: false, error: "Evento de e-mail não suportado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <div style="background:#f3f4f6;margin:0;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d1d5db;border-radius:16px;overflow:hidden;">
          <div style="background:#0f4c81;padding:22px 24px;color:#fff;">
            <div style="font-size:12px;font-weight:bold;opacity:.85;">HOMOLOGAÇÃO - CAMISAS EAC</div>
            <div style="font-size:22px;font-weight:bold;margin-top:4px;">${escapeHtml(copy.title)}</div>
          </div>
          <div style="padding:30px 26px;color:#1f2937;">
            <p style="font-size:16px;line-height:1.7;">Olá, <strong>${escapeHtml(payload.requesterName)}</strong>.</p>
            <p style="font-size:15px;line-height:1.7;">${escapeHtml(copy.body)}</p>
            <div style="margin:20px 0;background:#f8fafc;border:1px solid #d9e2ec;border-radius:12px;padding:14px;">
              <div><strong>Protocolo:</strong> ${escapeHtml(payload.protocol)}</div>
              ${payload.officialCode ? `<div style="margin-top:6px;"><strong>Pedido:</strong> ${escapeHtml(payload.officialCode)}</div>` : ""}
              <div style="margin-top:6px;"><strong>Beneficiário:</strong> ${escapeHtml(payload.beneficiaryName)}</div>
              <div style="margin-top:6px;"><strong>Valor:</strong> ${escapeHtml(formatMoney(Number(payload.totalAmount || 0)))}</div>
            </div>
            <p style="font-size:13px;color:#64748b;line-height:1.6;">Esta mensagem foi enviada pelo ambiente de homologação do processo de camisas.</p>
          </div>
        </div>
      </div>`;

    const text = `${copy.title}\n\nOlá, ${payload.requesterName}.\n\n${copy.body}\n\nProtocolo: ${payload.protocol}\nBeneficiário: ${payload.beneficiaryName}\nValor: ${formatMoney(Number(payload.totalAmount || 0))}\n\nHOMOLOGAÇÃO - CAMISAS EAC`;

    const result = await sendGmail({
      to: payload.to,
      subject: `[HOMOLOGAÇÃO] ${copy.subject}`,
      html,
      text,
    });

    return new Response(JSON.stringify({ success: true, message_id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("camisa-sandbox-email:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
