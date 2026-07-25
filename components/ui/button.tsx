import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-black transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97] will-change-transform",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-l from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-blue-600/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-600/25",
        secondary: "bg-gradient-to-l from-amber-400 via-orange-400 to-rose-400 text-slate-950 shadow-lg shadow-amber-500/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-500/25",
        outline: "border border-slate-200 bg-white/90 text-slate-800 shadow-sm backdrop-blur hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md",
        ghost: "text-slate-700 hover:bg-white/70 hover:text-blue-700 hover:shadow-sm",
        destructive: "bg-gradient-to-l from-rose-600 to-red-500 text-white shadow-lg shadow-red-500/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red-500/25"
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 rounded-2xl px-8 text-base",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
