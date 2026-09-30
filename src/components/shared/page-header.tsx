"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "@/navigation/router";

export function PageHeader({
  title,
  subtitle,
  back = false,
  actions,
  className,
  large = false,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  actions?: React.ReactNode;
  className?: string;
  large?: boolean;
}) {
  const { back: goBack } = useRouter();
  return (
    <header
      className={cn(
        "sticky top-0 z-30 -mx-4 mb-4 border-b bg-background/80 px-4 py-3 backdrop-blur-lg md:-mx-6 md:px-6",
        className,
      )}
    >
      <div className="flex min-h-10 items-center gap-2">
        {back ? (
          <button
            onClick={goBack}
            aria-label="بازگشت"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted active:bg-muted"
          >
            <ArrowRight className="size-5" aria-hidden />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className={cn("truncate font-bold leading-7", large ? "text-xl md:text-2xl" : "text-lg")}>
            {title}
          </h1>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
    </header>
  );
}
