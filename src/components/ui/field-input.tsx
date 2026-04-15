import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface FieldInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    prefix?: string;
    prefixWidth?: string;
    inputClassName?: string;
    prefixClassName?: string;
    inline?: boolean;
}

const FieldInput = React.forwardRef<HTMLInputElement, FieldInputProps>(
    ({ className, prefix, prefixWidth = "w-8", inputClassName, prefixClassName, inline = false, style, ...props }, ref) => {
        const getPaddingLeft = () => {
            if (prefixWidth === "w-6") return "1.25rem";
            if (prefixWidth === "w-7") return "1.5rem";
            if (prefixWidth === "w-8") return "1.75rem";
            return "1.5rem";
        };
        
        if (inline) {
            return (
                <div className={cn("relative flex-1", className)}>
                    {prefix && (
                        <span 
                            className={cn(
                                "absolute top-1/2 -translate-y-1/2 text-muted-foreground/40 text-[10px] md:text-[11px] font-mono select-none",
                                prefixClassName
                            )}
                            style={{ left: "0.5rem", zIndex: 0 }}
                        >
                            {prefix}
                        </span>
                    )}
                    <Input
                        ref={ref}
                        className={cn(
                            "h-5 md:h-6 text-[10px] md:text-[11px] font-mono bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring/50",
                            inputClassName
                        )}
                        style={{ 
                            paddingLeft: prefix ? getPaddingLeft() : undefined,
                            ...style 
                        }}
                        {...props}
                    />
                </div>
            );
        }
        
        return (
            <div className={cn("flex items-center gap-1.5 md:gap-2", className)}>
                {prefix && (
                    <span 
                        className={cn(
                            "text-[8px] md:text-[9px] text-muted-foreground/60 shrink-0",
                            prefixWidth,
                            prefixClassName
                        )}
                    >
                        {prefix}
                    </span>
                )}
                <Input
                    ref={ref}
                    className={cn(
                        "h-5 md:h-6 text-[9px] md:text-[10px] font-mono flex-1 bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:border-ring",
                        inputClassName
                    )}
                    {...props}
                />
            </div>
        );
    }
);

FieldInput.displayName = "FieldInput";

export { FieldInput };
