import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    throw new Error("Credenciais OAuth do Gmail não configuradas na Edge Function.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
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

  const mime = [
    `From: ${encodeHeaderUtf8(fromName)} <${fromEmail}>`,
    `To: ${params.to}`,
    `Subject: ${encodeHeaderUtf8(params.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="eac-camisas-boundary"',
    "",
    "--eac-camisas-boundary",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    params.text,
    "",
    "--eac-camisas-boundary",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    params.html,
    "",
    "--eac-camisas-boundary--",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405, headers: corsHeaders });

  let requestId = "";
  let supabaseClient: any = null;

  try {
    const { request_id, dispatch_token } = await req.json();
    requestId = String(request_id || "");
    if (!request_id || !dispatch_token) {
      return new Response(JSON.stringify({ success: false, error: "request_id e dispatch_token são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    let serviceRoleKey = "";

    try {
      const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
      serviceRoleKey = secretKeys.default || "";
    } catch {
      serviceRoleKey = "";
    }

    // Compatibilidade com projetos que ainda mantêm a service_role legada.
    if (!serviceRoleKey) {
      serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    }

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Credencial interna do Supabase não disponível na Edge Function.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    supabaseClient = supabase;

    const { data: order, error: orderError } = await supabase
      .from("camisa_solicitacoes")
      .select("id,codigo,encontro_id,nome_solicitante,email_solicitante,equipe,nome_beneficiario,valor_total,email_dispatch_token,email_confirmacao_enviada_em")
      .eq("id", requestId)
      .eq("email_dispatch_token", dispatch_token)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) {
      return new Response(JSON.stringify({ success: false, error: "Solicitação ou token de envio inválido." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.email_confirmacao_enviada_em) {
      return new Response(JSON.stringify({ success: true, already_sent: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order.email_solicitante) {
      await supabase.from("camisa_solicitacoes").update({ email_dispatch_token: null }).eq("id", requestId);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Solicitação sem e-mail." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: encontro }, { data: items, error: itemsError }] = await Promise.all([
      supabase.from("encontros").select("nome,numero,logo_url").eq("id", order.encontro_id).single(),
      supabase.from("camisa_solicitacao_itens").select("cor,tamanho,quantidade_solicitada").eq("solicitacao_id", requestId).order("criado_em"),
    ]);
    if (itemsError) throw itemsError;

    const encontroNome = encontro?.nome || "EAC";
    const logoUrl = encontro?.logo_url || Deno.env.get("EAC_LOGO_URL") || "";
    const instagramUrl = Deno.env.get("EAC_INSTAGRAM_URL") || "https://www.instagram.com/eacporciuncula/";
    const rows = (items || []).map((item) => `
      <tr>
        <td style="padding:10px;border:1px solid #d9e2ec;">${escapeHtml(item.tamanho)} | ${escapeHtml(item.cor)}</td>
        <td style="padding:10px;border:1px solid #d9e2ec;text-align:center;">${item.quantidade_solicitada}</td>
      </tr>`).join("");

    const html = `
      <div style="background:#f3f4f6;margin:0;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d1d5db;border-radius:16px;overflow:hidden;">
          <div style="background:#0f4c81;padding:26px 20px;text-align:center;">
            ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo EAC" style="max-width:90px;height:auto;display:block;margin:0 auto;" />` : `<div style="color:#fff;font-weight:bold;font-size:22px;">${escapeHtml(encontroNome)}</div>`}
          </div>
          <div style="padding:36px 28px;">
            <h1 style="margin:0 0 18px 0;font-size:22px;color:#0f4c81;">Olá, ${escapeHtml(order.nome_solicitante)}!</h1>
            <p style="margin:0 0 14px 0;font-size:16px;line-height:1.7;color:#1f2937;">Sua solicitação de camisa foi registrada com sucesso.</p>
            <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#1f2937;">
              <strong>Código:</strong> ${escapeHtml(order.codigo)}<br>
              <strong>Beneficiário:</strong> ${escapeHtml(order.nome_beneficiario)}<br>
              ${order.equipe ? `<strong>Equipe:</strong> ${escapeHtml(order.equipe)}<br>` : ""}
              <strong>Total:</strong> R$ ${Number(order.valor_total || 0).toFixed(2).replace(".", ",")}
            </p>
            <table style="width:100%;border-collapse:collapse;margin-top:18px;margin-bottom:22px;">
              <thead><tr style="background:#eaf2fb;"><th style="padding:10px;border:1px solid #d9e2ec;text-align:left;">Item</th><th style="padding:10px;border:1px solid #d9e2ec;text-align:center;">Qtd</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#1f2937;">A solicitação não depende do estoque disponível neste momento. A coordenação fará o controle de reposição e entrega.</p>
            <p style="margin:24px 0 0 0;font-size:15px;line-height:1.7;color:#1f2937;">Fraternalmente,<br><strong>Coordenação EAC</strong></p>
            <div style="text-align:center;margin:30px 0 0 0;"><a href="${escapeHtml(instagramUrl)}" target="_blank" style="display:inline-block;background:#0f4c81;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:10px;font-size:15px;">SIGA NOSSO INSTAGRAM</a></div>
          </div>
        </div>
      </div>`;

    const text = `Olá, ${order.nome_solicitante}!\n\nSua solicitação de camisa foi registrada com sucesso.\nCódigo: ${order.codigo}\nBeneficiário: ${order.nome_beneficiario}\nTotal: R$ ${Number(order.valor_total || 0).toFixed(2).replace(".", ",")}\n\nFraternalmente,\nCoordenação EAC`;

    const gmailResult = await sendGmail({
      to: order.email_solicitante,
      subject: `${encontroNome} - Solicitação de camisa registrada - ${order.codigo}`,
      html,
      text,
    });

    await supabase.from("camisa_solicitacoes").update({
      email_confirmacao_enviada_em: new Date().toISOString(),
      email_confirmacao_erro: null,
      email_dispatch_token: null,
    }).eq("id", requestId);

    return new Response(JSON.stringify({ success: true, message_id: gmailResult.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : typeof error === "object"
        ? JSON.stringify(error)
        : String(error);

    console.error("camisa-email:", message, error);

    if (supabaseClient && requestId) {
      try {
        await supabaseClient
          .from("camisa_solicitacoes")
          .update({ email_confirmacao_erro: message.slice(0, 2000) })
          .eq("id", requestId);
      } catch (updateError) {
        console.error("Falha ao registrar erro de e-mail:", updateError);
      }
    }

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
