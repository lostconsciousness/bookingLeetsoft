import { Mail, MessageCircle, Phone, Send, ShieldCheck } from "lucide-react";
import { useTranslation } from "../i18n/I18nContext";
import { channelLabel } from "../lib/api";

type Props = {
  channel: string;
  message: string;
  actionUrl?: string;
};

const iconMap: Record<string, any> = {
  whatsapp: MessageCircle,
  sms: Send,
  email: Mail,
  telegram: Send,
  voice: Phone,
};

const URL_PATTERN = /https?:\/\/[^\s]+/;

function MessageWithAction({ message, actionUrl }: Pick<Props, "message" | "actionUrl">) {
  const { t } = useTranslation();
  const detectedUrl = actionUrl ?? message.match(URL_PATTERN)?.[0]?.replace(/[.,;!?]+$/, "");
  if (!detectedUrl || !message.includes(detectedUrl)) {
    return <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message}</p>;
  }
  const [before, after = ""] = message.split(detectedUrl, 2);
  const trailingMessage = after.trim().replace(/^[.,;]\s*/, "");
  return (
    <div className="min-w-0 space-y-3">
      {before.trim() ? <p className="whitespace-pre-wrap break-words">{before.trim()}</p> : null}
      <a
        href={detectedUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-full items-center gap-2 rounded-md bg-accent-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-800"
      >
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span className="truncate">{t("channelPreview.secureAction")}</span>
      </a>
      <p className="text-xs leading-5 text-slate-500">{t("channelPreview.secureLinkHint")}</p>
      {trailingMessage ? <p className="whitespace-pre-wrap break-words">{trailingMessage}</p> : null}
    </div>
  );
}

export function ChannelPreview({ channel, message, actionUrl }: Props) {
  const { t } = useTranslation();
  const Icon = iconMap[channel] ?? MessageCircle;
  if (channel === "email") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">{t("channelPreview.emailSubject")}</div>
        <div className="min-w-0 p-5 text-sm leading-6 text-slate-700"><MessageWithAction message={message} actionUrl={actionUrl} /></div>
      </div>
    );
  }
  if (channel === "voice") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon className="h-4 w-4" />
          {t("channelPreview.voicePreview")}
        </div>
        <p className="break-words text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">{message.replace(URL_PATTERN, t("channelPreview.voiceLinkPlaceholder"))}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-[#eef8f7] p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-accent-700">
        <Icon className="h-4 w-4" />
        {channelLabel(t, channel)}
      </div>
      <div className="ml-auto min-w-0 max-w-md rounded-lg bg-white p-4 text-sm leading-6 text-slate-700 shadow-soft"><MessageWithAction message={message} actionUrl={actionUrl} /></div>
    </div>
  );
}
