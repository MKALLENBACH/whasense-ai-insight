import { LeadTemperature } from "@/types";
import { cn } from "@/lib/utils";
import { Flame, ThermometerSun, Snowflake } from "lucide-react";

interface LeadTemperatureBadgeProps {
  temperature: LeadTemperature;
  showLabel?: boolean;
  size?: "sm" | "md";
}

const config = {
  cold: {
    icon: Snowflake,
    label: "Frio",
    className: "bg-lead-cold/10 text-lead-cold border-lead-cold/20",
    dotClassName: "bg-lead-cold",
  },
  warm: {
    icon: ThermometerSun,
    label: "Morno",
    className: "bg-lead-warm/10 text-lead-warm border-lead-warm/20",
    dotClassName: "bg-lead-warm",
  },
  hot: {
    icon: Flame,
    label: "Quente",
    className: "bg-lead-hot/10 text-lead-hot border-lead-hot/20",
    dotClassName: "bg-lead-hot animate-pulse",
  },
};

const LeadTemperatureBadge = ({ temperature, showLabel = true, size = "md" }: LeadTemperatureBadgeProps) => {
  const { icon: Icon, label, className, dotClassName } = config[temperature];

  if (!showLabel) {
    return (
      <div className={cn("h-3 w-3 rounded-full", dotClassName)} title={label} />
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        className,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      {label}
    </div>
  );
};

export default LeadTemperatureBadge;
