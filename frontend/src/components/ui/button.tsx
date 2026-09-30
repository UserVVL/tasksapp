import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-[15px] font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary-gradient text-white shadow-glow hover:shadow-glow-lg hover:brightness-110 active:brightness-90",
        destructive:
          "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20",
        outline:
          "glass text-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20 active:bg-black/5 dark:active:bg-white/5",
        secondary:
          "bg-black/5 dark:bg-white/5 text-foreground border border-border hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20",
        ghost:
          "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
        link:
          "text-purple-400 underline-offset-4 hover:underline hover:text-purple-300",
      },
      size: {
        default: "h-[46px] px-5 py-2 rounded-[14px]",
        sm: "h-9 px-3 rounded-[10px] text-sm",
        lg: "h-[52px] px-8 rounded-[16px] text-base",
        icon: "h-11 w-11 rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
