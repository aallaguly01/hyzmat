export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface WebAppButton {
  text: string;
  web_app: { url: string };
}

export interface BotApi {
  sendMessage(params: {
    chat_id: number;
    text: string;
    reply_markup?: { inline_keyboard: WebAppButton[][] };
  }): Promise<void>;
  setWebhook(params: {
    url: string;
    secret_token: string;
    allowed_updates?: string[];
  }): Promise<void>;
}

/** Минимальный клиент Telegram Bot API на встроенном fetch. */
export function createBotApi(token: string, fetchImpl: FetchLike = fetch): BotApi {
  const call = async (method: string, params: object) => {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
    } | null;
    if (!res.ok || !body?.ok) {
      throw new Error(`Bot API ${method}: ${body?.description ?? res.status}`);
    }
  };

  return {
    sendMessage: (params) => call('sendMessage', params),
    setWebhook: (params) => call('setWebhook', params),
  };
}
