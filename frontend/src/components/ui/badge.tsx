import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-purple-500/20 bg-purple-500/10 text-purple-300",
        secondary:
          "border-border bg-black/5 dark:bg-white/5 text-muted-foreground",
        destructive:
          "border-red-500/20 bg-red-500/10 text-red-400",
        success:
          "border-green-500/20 bg-green-500/10 text-green-400",
        warning:
          "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
        outline:
          "border-border text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
