import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        discovered: "border-transparent bg-blue-500 text-white",
        filtered_out: "border-transparent bg-gray-500 text-white",
        downloaded: "border-transparent bg-cyan-500 text-white",
        uploaded_r2: "border-transparent bg-teal-500 text-white",
        ready: "border-transparent bg-green-500 text-white",
        scheduled: "border-transparent bg-yellow-500 text-white",
        processing: "border-transparent bg-orange-500 text-white",
        published: "border-transparent bg-green-600 text-white",
        failed: "border-transparent bg-red-600 text-white",
        ignored_duplicate: "border-transparent bg-gray-400 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
