import { useTheme } from "next-themes"
import { Toaster as Sonner, toast as sonnerToast, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

function replaceToast<T>(show: () => T) {
  sonnerToast.dismiss()
  return show()
}

const toast = Object.assign(
  (...args: Parameters<typeof sonnerToast>) => replaceToast(() => sonnerToast(...args)),
  {
    success: (...args: Parameters<typeof sonnerToast.success>) =>
      replaceToast(() => sonnerToast.success(...args)),
    info: (...args: Parameters<typeof sonnerToast.info>) =>
      replaceToast(() => sonnerToast.info(...args)),
    warning: (...args: Parameters<typeof sonnerToast.warning>) =>
      replaceToast(() => sonnerToast.warning(...args)),
    error: (...args: Parameters<typeof sonnerToast.error>) =>
      replaceToast(() => sonnerToast.error(...args)),
    loading: (...args: Parameters<typeof sonnerToast.loading>) =>
      replaceToast(() => sonnerToast.loading(...args)),
    promise: sonnerToast.promise,
    dismiss: sonnerToast.dismiss,
  },
)

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      visibleToasts={1}
      {...props}
    />
  )
}

export { Toaster, toast }
