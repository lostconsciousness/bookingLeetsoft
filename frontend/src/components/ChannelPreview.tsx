import { Mail, MessageCircle, Phone, Send } from "lucide-react";

type Props = {
  channel: string;
  message: string;
};

const iconMap: Record<string, any> = {
  whatsapp: MessageCircle,
  sms: Send,
  email: Mail,
  telegram: Send,
  voice: Phone,
};

export function ChannelPreview({ channel, message }: Props) {
  const Icon = iconMap[channel] ?? MessageCircle;
  if (channel === "email") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">Subject: Earlier appointment opening</div>
        <div className="p-5 text-sm leading-6 text-slate-700">{message}</div>
      </div>
    );
  }
  if (channel === "voice") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon className="h-4 w-4" />
          Voice call script preview
        </div>
        <p className="text-sm leading-6 text-slate-700">{message}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-[#eef8f7] p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold capitalize text-accent-700">
        <Icon className="h-4 w-4" />
        {channel}
      </div>
      <div className="ml-auto max-w-md rounded-lg bg-white p-4 text-sm leading-6 text-slate-700 shadow-soft">{message}</div>
    </div>
  );
}

