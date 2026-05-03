import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange disabled:pointer-events-none disabled:opacity-50 active:scale-95",
          variant === "default" && "bg-brand-orange text-white hover:bg-brand-orange/90 shadow-lg shadow-brand-orange/20",
          variant === "destructive" && "bg-red-500 text-white hover:bg-red-600",
          variant === "outline" && "border border-zinc-200 bg-white hover:bg-zinc-100 hover:text-zinc-900",
          variant === "secondary" && "bg-white/10 text-white hover:bg-white/20",
          variant === "ghost" && "hover:bg-white/5 text-zinc-400 hover:text-white",
          size === "default" && "h-12 px-6 py-2",
          size === "sm" && "h-9 rounded-lg px-3",
          size === "lg" && "h-14 rounded-2xl px-8",
          size === "icon" && "h-10 w-10",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };